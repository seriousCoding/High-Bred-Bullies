import { Express, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { coinbaseClient } from './coinbase-client';
import { keyVault } from './key-vault';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import * as crypto from 'crypto';

// Define custom session data
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    oauth_state?: string;
    authenticated?: boolean;
  }
}

// Create a session store for authentication
const createSessionStore = () => {
  const MemoryStore = createMemoryStore(session);
  return new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
};

// Setup authentication middleware and session management
export function setupAuth(app: Express) {
  // Initialize session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: createSessionStore(),
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Add user data to session if not present
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      // For development/testing, assign a default user ID
      // In production, this would be set during login
      req.session.userId = 1;
    }
    next();
  });
}

// Universal authentication middleware that adds authentication headers
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Get user ID from session or header
    const userId = req.session.userId || parseInt(req.headers['x-user-id'] as string) || 0;
    
    // Set the user ID in headers for downstream middlewares
    req.headers['x-user-id'] = userId.toString();
    
    // Set API key headers if they exist in the request
    const apiKey = req.headers['x-api-key'] as string;
    const apiSecret = req.headers['x-api-secret'] as string;
    
    if (apiKey && apiSecret) {
      // Set credentials in the client for this request
      coinbaseClient.setCredentials(apiKey, apiSecret);
    } else if (userId > 0) {
      // Try to get API key from vault using key rotation if user is authenticated
      try {
        const credentials = await keyVault.getNextKey(userId);
        if (credentials) {
          // Set the credentials in the client
          coinbaseClient.setCredentials(credentials.apiKey, credentials.apiSecret);
          
          // Store the key ID in request for later updating its status
          (req as any).keyId = credentials.keyId;
        }
      } catch (err) {
        console.log('Failed to get API key from vault:', err);
        // Continue even if key retrieval fails
      }
    }
    
    // Continue to the next middleware
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Failed to authenticate request'
    });
  }
}

// API key authentication middleware - enforces API key requirements
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const apiSecret = req.headers['x-api-secret'] as string;
    
    if (apiKey && apiSecret) {
      // Credentials are already set in authenticateRequest middleware
      return next();
    }
    
    // Try to get API key from vault using key rotation
    const userId = parseInt(req.headers['x-user-id'] as string) || 0;
    const credentials = await keyVault.getNextKey(userId);
    
    if (credentials) {
      // Set the credentials in the client
      coinbaseClient.setCredentials(credentials.apiKey, credentials.apiSecret);
      
      // Store the key ID in request for later updating its status
      (req as any).keyId = credentials.keyId;
      
      return next();
    }
    
    // No API keys available
    return res.status(401).json({
      error: 'API key required',
      message: 'This endpoint requires API credentials. Please add your Coinbase API key and secret.'
    });
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// OAuth token validation middleware
export function requireOAuthToken(req: Request, res: Response, next: NextFunction) {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    
    if (!accessToken) {
      return res.status(401).json({
        error: 'OAuth token required',
        message: 'This endpoint requires OAuth authentication. Please connect your Coinbase account.'
      });
    }
    
    // Token exists, continue
    next();
  } catch (error) {
    console.error('OAuth authentication error:', error);
    return res.status(500).json({ error: 'OAuth authentication error' });
  }
}