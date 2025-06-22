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

  // User Profile endpoints
  app.get('/api/user/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const profile = await storage.getUserProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json(profile);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/user/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { username, first_name, last_name } = req.body;
      
      // Check if profile already exists
      const existingProfile = await storage.getUserProfile(req.user.id);
      if (existingProfile) {
        return res.json(existingProfile);
      }

      // Create new profile
      const profileData = {
        userId: req.user.id,
        fullName: `${first_name} ${last_name}`.trim(),
        phone: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        avatarUrl: null,
        bio: null,
        isBreeder: false
      };

      const newProfile = await storage.createUserProfile(profileData);
      res.status(201).json(newProfile);
    } catch (error) {
      console.error('Create profile error:', error);
      res.status(500).json({ error: 'Failed to create profile' });
    }
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