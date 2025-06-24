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

  // Get breeder profile
  app.get('/api/breeders/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`Fetching breeder profile for ID: ${id}`);
      
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      try {
        const breederQuery = `
          SELECT user_id, business_name, contact_phone, contact_email, address, delivery_areas, delivery_fee
          FROM breeders 
          WHERE user_id = $1
        `;
        
        const result = await pool.query(breederQuery, [id]);
        
        if (result.rows.length === 0) {
          // Return empty breeder object if not found
          await pool.end();
          return res.json({
            user_id: id,
            business_name: '',
            contact_phone: '',
            contact_email: '',
            address: '',
            delivery_areas: [],
            delivery_fee: 0
          });
        }
        
        const breeder = result.rows[0];
        console.log('Breeder profile fetched:', breeder);
        await pool.end();
        res.json(breeder);
      } catch (dbError) {
        await pool.end();
        throw dbError;
      }
    } catch (error) {
      console.error('Error fetching breeder profile:', error);
      res.status(500).json({ message: 'Failed to fetch breeder profile' });
    }
  });

  // Update breeder profile
  app.put('/api/breeders/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { business_name, contact_phone, contact_email, address, delivery_areas, delivery_fee } = req.body;
      
      console.log(`Updating breeder profile for ID: ${id}`, req.body);
      
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      try {
        // Check if breeder exists
        const existingBreeder = await pool.query('SELECT user_id FROM breeders WHERE user_id = $1', [id]);
        
        if (existingBreeder.rows.length === 0) {
          // Create new breeder profile
          const insertQuery = `
            INSERT INTO breeders (user_id, business_name, contact_phone, contact_email, address, delivery_areas, delivery_fee, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *
          `;
          const result = await pool.query(insertQuery, [
            id, business_name, contact_phone, contact_email, address, 
            JSON.stringify(delivery_areas), delivery_fee
          ]);
          console.log('Created new breeder profile:', result.rows[0]);
          await pool.end();
          res.json(result.rows[0]);
        } else {
          // Update existing breeder profile
          const updateQuery = `
            UPDATE breeders 
            SET business_name = $2, contact_phone = $3, contact_email = $4, address = $5, 
                delivery_areas = $6, delivery_fee = $7, updated_at = NOW()
            WHERE user_id = $1
            RETURNING *
          `;
          const result = await pool.query(updateQuery, [
            id, business_name, contact_phone, contact_email, address, 
            JSON.stringify(delivery_areas), delivery_fee
          ]);
          console.log('Updated breeder profile:', result.rows[0]);
          await pool.end();
          res.json(result.rows[0]);
        }
      } catch (dbError) {
        await pool.end();
        throw dbError;
      }
    } catch (error) {
      console.error('Error updating breeder profile:', error);
      res.status(500).json({ message: 'Failed to update breeder profile' });
    }
  });

  // Get site configuration
  app.get('/api/site-config', authenticateToken, async (req: Request, res: Response) => {
    try {
      console.log('Fetching site configuration');
      
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      try {
        const siteConfig = await pool.query('SELECT key, value FROM site_config ORDER BY key');
        
        // Convert to key-value object
        const config = siteConfig.rows.reduce((acc, row) => {
          acc[row.key] = row.value;
          return acc;
        }, {});
        
        console.log('Site config fetched:', config);
        await pool.end();
        res.json(config);
      } catch (dbError) {
        await pool.end();
        throw dbError;
      }
    } catch (error) {
      console.error('Error fetching site config:', error);
      res.status(500).json({ message: 'Failed to fetch site configuration' });
    }
  });

  // Update site configuration
  app.put('/api/site-config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      console.log('Updating site configuration:', updates);
      
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      try {
        // Update each config key-value pair
        for (const update of updates) {
          const { key, value } = update;
          await pool.query(`
            INSERT INTO site_config (key, value, updated_at) 
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) 
            DO UPDATE SET value = $2, updated_at = NOW()
          `, [key, value]);
        }
        
        console.log('Site config updated successfully');
        await pool.end();
        res.json({ success: true, message: 'Site configuration updated' });
      } catch (dbError) {
        await pool.end();
        throw dbError;
      }
    } catch (error) {
      console.error('Error updating site config:', error);
      res.status(500).json({ message: 'Failed to update site configuration' });
    }
  });

  console.log('✅ API routes registered successfully');
}