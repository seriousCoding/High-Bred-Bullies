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

// JWT helper functions
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '24h';

interface JwtPayload {
  userId: number;
  username: string;
}

function generateToken(user: { id: number; username: string }): string {
  return jwt.sign(
    { userId: user.id, username: user.username } as JwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

// Hash a password using bcryptjs
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Compare a password with a hashed password
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Setup authentication routes
export function setupAuth(app: Express) {

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
      
      // Generate JWT token
      const token = generateToken(user);
      
      // Return user info (without password) and token
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({
        ...userWithoutPassword,
        token
      });
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
      
      // Generate JWT token
      const token = generateToken(user);
      
      // Return user info (without password) and token
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json({
        ...userWithoutPassword,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: 'Failed to login. Please try again.'
      });
    }
  });

  // User logout endpoint (JWT tokens are stateless, so just confirm logout)
  app.post('/api/logout', (req: Request, res: Response) => {
    // With JWT tokens, logout is handled client-side by removing the token
    res.status(200).json({ message: 'Logged out successfully' });
  });

  // Get current user endpoint
  app.get('/api/user', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'You must be logged in to access this resource'
        });
      }
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
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

// JWT authentication middleware
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      message: 'You must provide an access token'
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({
      error: 'Invalid token',
      message: 'Your access token is invalid or expired'
    });
  }

  req.user = { id: payload.userId, username: payload.username };
  next();
}

// Universal authentication middleware that adds authentication headers
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    // If no token, allow public routes
    if (!token) {
      return next();
    }
    
    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload) {
      // Invalid token, but allow public routes
      return next();
    }
    
    // Set user info in request
    req.user = { id: payload.userId, username: payload.username };
    const userId = payload.userId;
    
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
          req.keyId = credentials.keyId;
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
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
        needsLogin: true
      });
    }
    
    const userId = req.user.id;
    
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
      req.keyId = credentials.keyId;
      
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