import { Express, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { z } from 'zod';
import { storage } from './storage';
import { log } from './vite';
import { authenticateToken } from './auth';

// Register API routes for High Bred Bullies dog breeding platform
export async function registerApiRoutes(app: Express, server: HttpServer): Promise<void> {
  
  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      service: 'High Bred Bullies API',
      timestamp: new Date().toISOString() 
    });
  });

  // Litters endpoints
  app.get('/api/litters', async (req: Request, res: Response) => {
    try {
      const litters = await storage.getLitters();
      res.json(litters);
    } catch (error) {
      console.error('Error fetching litters:', error);
      res.status(500).json({ error: 'Failed to fetch litters' });
    }
  });

  app.get('/api/litters/featured', async (req: Request, res: Response) => {
    try {
      const featuredLitters = await storage.getFeaturedLitters();
      res.json(featuredLitters);
    } catch (error) {
      console.error('Error fetching featured litters:', error);
      res.status(500).json({ error: 'Failed to fetch featured litters' });
    }
  });

  app.get('/api/litters/:id', async (req: Request, res: Response) => {
    try {
      const litter = await storage.getLitter(parseInt(req.params.id));
      if (!litter) {
        res.status(404).json({ error: 'Litter not found' });
        return;
      }
      res.json(litter);
    } catch (error) {
      console.error('Error fetching litter:', error);
      res.status(500).json({ error: 'Failed to fetch litter' });
    }
  });

  // Blog endpoints
  app.get('/api/blog/posts', async (req: Request, res: Response) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  app.get('/api/blog/posts/:slug', async (req: Request, res: Response) => {
    try {
      const post = await storage.getBlogPost(req.params.slug);
      if (!post) {
        res.status(404).json({ error: 'Blog post not found' });
        return;
      }
      res.json(post);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  });

  // Protected routes for authenticated users
  app.get('/api/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      const profile = await storage.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  // Admin routes (require authentication)
  app.post('/api/litters', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const litter = await storage.createLitter(req.body, userId);
      res.status(201).json(litter);
    } catch (error) {
      console.error('Error creating litter:', error);
      res.status(500).json({ error: 'Failed to create litter' });
    }
  });

  app.post('/api/blog/posts', authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const post = await storage.createBlogPost(req.body, userId);
      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating blog post:', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  log('High Bred Bullies API routes registered successfully', 'api');
}