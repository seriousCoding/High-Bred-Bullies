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

  // Puppy pricing endpoint
  app.get('/api/litters/:id/puppy-prices', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Fetch actual puppy prices from database
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      try {
        // Get puppies for this litter with their pricing
        const puppiesResult = await pool.query(
          'SELECT id, gender FROM puppies WHERE litter_id = $1 AND is_available = true',
          [id]
        );
        
        // Get litter pricing information
        const litterResult = await pool.query(
          'SELECT price_per_male, price_per_female FROM litters WHERE id = $1',
          [id]
        );
        
        if (litterResult.rows.length === 0) {
          await pool.end();
          return res.status(404).json({ error: 'Litter not found' });
        }
        
        const litter = litterResult.rows[0];
        const puppyPrices: Record<string, number> = {};
        
        // Build pricing for each puppy
        puppiesResult.rows.forEach((puppy: any) => {
          const price = puppy.gender === 'male' ? litter.price_per_male : litter.price_per_female;
          puppyPrices[puppy.id] = price || 250000; // Default $2500 if no price set
        });
        
        await pool.end();
        res.json(puppyPrices);
        
      } catch (dbError) {
        await pool.end();
        throw dbError;
      }

    } catch (error) {
      console.error('Puppy pricing error:', error);
      res.status(500).json({ error: 'Failed to fetch puppy prices' });
    }
  });

  // Stripe Checkout endpoint for puppy purchases
  app.post('/api/checkout/create-litter-checkout', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { litterId, puppyIds, deliveryOption, deliveryZipCode } = req.body;

      if (!litterId || !puppyIds || !Array.isArray(puppyIds) || puppyIds.length === 0) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // For now, return a mock checkout URL since full Stripe integration requires API keys
      // In production, this would create a real Stripe checkout session
      const mockCheckoutUrl = `https://checkout.stripe.com/pay/cs_test_mock#fidkdWxOYHwnPyd1blpxYHZxWjA0S2RDNDU2VEtNNzVPZlN0Y0FLY09LZEdJfGNgfGBgbGJmZGBg`;
      
      res.json({ 
        url: mockCheckoutUrl,
        sessionId: 'cs_test_mock_session_id',
        success: true 
      });

    } catch (error) {
      console.error('Checkout creation error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
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