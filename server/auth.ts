import { Express, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { coinbaseClient } from './coinbase-client';
import { keyVault } from './key-vault';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';

// Extended Request interface for authenticated routes
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string };
      keyId?: number;
    }
  }
}

// Create a session store for authentication
const createSessionStore = () => {
  const MemoryStore = createMemoryStore(session);
  return new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
};

// Hash a password
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

// Compare a password with a hashed password
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [hash, salt] = hashedPassword.split('.');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(hash === derivedKey.toString('hex'));
    });
  });
}

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

  // User registration endpoint
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      // Validate request body with zod
      const loginSchema = insertUserSchema.extend({
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      
      const userData = loginSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({
          error: 'Username taken',
          message: 'This username is already taken. Please choose another one.'
        });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Set user in session
      req.session.userId = user.id;
      req.session.authenticated = true;
      
      // Return user info (without password)
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      res.status(500).json({
        error: 'Registration failed',
        message: 'Failed to register user. Please try again.'
      });
    }
  });

  // User login endpoint
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          error: 'Missing credentials',
          message: 'Username and password are required'
        });
      }
      
      // Get user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }
      
      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }
      
      // Set user in session
      req.session.userId = user.id;
      req.session.authenticated = true;
      
      // Return user info (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: 'Failed to login. Please try again.'
      });
    }
  });

  // User logout endpoint
  app.post('/api/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
          error: 'Logout failed',
          message: 'Failed to logout. Please try again.'
        });
      }
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });

  // Get current user endpoint
  app.get('/api/user', async (req: Request, res: Response) => {
    try {
      if (!req.session.userId || !req.session.authenticated) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'You must be logged in to access this resource'
        });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({
          error: 'User not found',
          message: 'Your user account could not be found'
        });
      }
      
      // Check if user has API keys
      const apiKeys = await keyVault.getUserKeys(user.id);
      
      // Return user info (without password) and API key status
      const { password, ...userWithoutPassword } = user;
      res.status(200).json({
        ...userWithoutPassword,
        hasApiKeys: apiKeys.length > 0
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        error: 'User fetch failed',
        message: 'Failed to get user information'
      });
    }
  });
}

// Universal authentication middleware that adds authentication headers
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if the user is authenticated via session
    if (!req.session.authenticated || !req.session.userId) {
      // Skip authenticated routes, allow public routes
      return next();
    }
    
    const userId = req.session.userId;
    
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
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred while processing your request'
    });
  }
}

// API key authentication middleware - enforces API key requirements
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    // Check authentication first
    if (!req.session.authenticated || !req.session.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
        needsLogin: true
      });
    }
    
    const userId = req.session.userId;
    
    // Direct API key in headers
    const apiKey = req.headers['x-api-key'] as string;
    const apiSecret = req.headers['x-api-secret'] as string;
    
    if (apiKey && apiSecret) {
      // Credentials are already set in authenticateRequest middleware
      return next();
    }
    
    // Try to get API key from vault using key rotation
    const credentials = await keyVault.getNextKey(userId);
    
    if (credentials) {
      // Set the credentials in the client
      coinbaseClient.setCredentials(credentials.apiKey, credentials.apiSecret);
      
      // Store the key ID in request for later updating its status
      (req as any).keyId = credentials.keyId;
      
      return next();
    }
    
    // Check if user has any API keys (active or inactive)
    const allKeys = await keyVault.getUserKeys(userId);
    
    if (allKeys.length === 0) {
      // User has no API keys at all - first time setup required
      return res.status(403).json({
        error: 'API key required',
        message: 'This endpoint requires a Coinbase API key. Please add your API credentials.',
        needsApiKey: true
      });
    } else {
      // User has keys but none are active/valid
      return res.status(403).json({
        error: 'Valid API key required',
        message: 'None of your API keys are valid. Please add a valid Coinbase API key.',
        needsApiKey: true
      });
    }
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