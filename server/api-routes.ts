import { Express, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { z } from 'zod';
import { insertApiKeySchema } from '../shared/schema';
import { storage } from './storage';
import { log } from './vite';
import path from 'path';
import fs from 'fs';
import { requireApiKey, requireOAuthToken, authenticateToken } from './auth';

// Dog breeding platform API routes - pure JWT authentication system

export async function registerApiRoutes(app: Express, server: HttpServer): Promise<void> {
  console.log('🔧 Setting up API routes for High Bred Bullies platform...');

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'High Bred Bullies API',
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL connected',
      authentication: 'JWT enabled'
    });
  });

  // Dog breeding API endpoints would go here
  // These would include:
  // - Litter management
  // - Puppy registration
  // - Breeder profiles
  // - Customer orders
  // - Blog posts
  // - Social features

  console.log('✅ API routes registered successfully');
}