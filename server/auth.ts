import { Express, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { insertUserSchema } from '../shared/schema';
import { z } from 'zod';

// Extend Express Request interface for JWT authentication
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string };
    }
  }
}

interface JwtPayload {
  userId: number;
  username: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'savvai_jwt_secret_key_2025';

function generateToken(user: { id: number; username: string }): string {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '24h' }
  );
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

async function hashPassword(password: string): Promise<string> {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function setupAuth(app: Express) {
  console.log('🔐 Setting up JWT authentication system...');

  // Register endpoint
  app.post('/api/register', async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        res.status(400).json({ message: 'Username already exists' });
        return;
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password_hash);
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password_hash: hashedPassword
      });

      // Generate token
      const token = generateToken({ id: user.id, username: user.username });

      res.status(201).json({
        message: 'User created successfully',
        user: { id: user.id, username: user.username },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid input data', errors: error.errors });
        return;
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Login endpoint
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Get user profile to check if they're a breeder
      const userProfile = await storage.getUserProfile(user.id);
      const isBreeder = userProfile?.isBreeder || false;

      // Generate token
      const token = generateToken({ id: user.id, username: user.username });

      res.json({
        message: 'Login successful',
        token,
        user: { 
          id: user.id, 
          username: user.username,
          isBreeder 
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Logout endpoint (client-side token removal)
  app.post('/api/logout', (req: Request, res: Response) => {
    res.json({ message: 'Logout successful' });
  });

  // Get current user endpoint
  app.get('/api/user', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const userProfile = await storage.getUserProfile(user.id);
      const isBreeder = userProfile?.isBreeder || false;

      res.json({
        id: user.id,
        username: user.username,
        isBreeder
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  console.log('✅ JWT authentication routes registered');
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired token' });
    return;
  }

  req.user = { id: payload.userId, username: payload.username };
  next();
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { id: payload.userId, username: payload.username };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // For now, this is a stub - JWT authentication handles most cases
  // This can be expanded if API key functionality is needed for dog breeding platform
  authenticateToken(req, res, next);
}

export function requireOAuthToken(req: Request, res: Response, next: NextFunction) {
  // OAuth functionality removed - using JWT authentication only
  authenticateToken(req, res, next);
}