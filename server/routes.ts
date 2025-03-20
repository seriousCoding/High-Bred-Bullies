import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { coinbaseApi } from "./coinbase-api";
import { z } from "zod";
import { insertApiKeySchema } from "@shared/schema";
import { WebSocketServer } from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// OAuth configuration
const COINBASE_OAUTH_CLIENT_ID = process.env.COINBASE_OAUTH_CLIENT_ID;
const COINBASE_OAUTH_CLIENT_SECRET = process.env.COINBASE_OAUTH_CLIENT_SECRET;
const COINBASE_AUTH_URL = 'https://login.coinbase.com/oauth2/auth';
const COINBASE_TOKEN_URL = 'https://login.coinbase.com/oauth2/token';

// Debug OAuth configuration
console.log("OAuth credentials status:", {
  client_id_available: !!COINBASE_OAUTH_CLIENT_ID,
  client_secret_available: !!COINBASE_OAUTH_CLIENT_SECRET
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup WebSocket server for real-time data with specific path
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle subscription requests
        if (data.type === 'subscribe') {
          // Forward subscription to Coinbase
          const subscriptionResult = await coinbaseApi.subscribeToFeed(data);
          ws.send(JSON.stringify(subscriptionResult));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Forward real-time data from Coinbase to connected clients
  coinbaseApi.onMessage((data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  // API Key Management
  app.post('/api/keys', async (req: Request, res: Response) => {
    try {
      const apiKeyData = insertApiKeySchema.parse(req.body);
      const storedKey = await storage.storeApiKey(apiKeyData);
      
      // Return only partial key info for security
      res.status(201).json({
        id: storedKey.id,
        userId: storedKey.userId,
        label: storedKey.label,
        createdAt: storedKey.createdAt
      });
    } catch (error) {
      console.error('Error storing API key:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid API key data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to store API key' });
    }
  });

  app.get('/api/keys', async (req: Request, res: Response) => {
    try {
      // In a real app, you'd get userId from auth session
      const userId = 1; // Placeholder
      const keys = await storage.getApiKeys(userId);
      
      // Only return partial key info for security
      const safeKeys = keys.map(key => ({
        id: key.id,
        userId: key.userId,
        label: key.label,
        isActive: key.isActive,
        createdAt: key.createdAt,
        // Show only first and last few characters of the API key
        apiKeyPreview: `${key.apiKey.substring(0, 4)}...${key.apiKey.substring(key.apiKey.length - 4)}`
      }));
      
      res.json(safeKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Failed to fetch API keys' });
    }
  });

  // Coinbase API Products Endpoints
  app.get('/api/products', async (req: Request, res: Response) => {
    try {
      // Try to use env vars first, then fall back to headers
      const apiKey = process.env.COINBASE_API_KEY || req.headers['x-api-key'] as string;
      const apiSecret = process.env.COINBASE_API_SECRET || req.headers['x-api-secret'] as string;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const products = await coinbaseApi.getProducts(apiKey, apiSecret);
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Failed to fetch products' });
    }
  });

  app.get('/api/products/:productId/book', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      // Try to use env vars first, then fall back to headers
      const apiKey = process.env.COINBASE_API_KEY || req.headers['x-api-key'] as string;
      const apiSecret = process.env.COINBASE_API_SECRET || req.headers['x-api-secret'] as string;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const orderBook = await coinbaseApi.getProductBook(productId, apiKey, apiSecret);
      res.json(orderBook);
    } catch (error) {
      console.error('Error fetching order book:', error);
      res.status(500).json({ message: 'Failed to fetch order book' });
    }
  });

  app.get('/api/products/:productId/candles', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const { start, end, granularity } = req.query;
      // Try to use env vars first, then fall back to headers
      const apiKey = process.env.COINBASE_API_KEY || req.headers['x-api-key'] as string;
      const apiSecret = process.env.COINBASE_API_SECRET || req.headers['x-api-secret'] as string;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const candles = await coinbaseApi.getCandles(
        productId, 
        apiKey, 
        apiSecret, 
        start as string, 
        end as string, 
        granularity as string
      );
      res.json(candles);
    } catch (error) {
      console.error('Error fetching candles:', error);
      res.status(500).json({ message: 'Failed to fetch candles' });
    }
  });

  // Coinbase API Account Endpoints
  app.get('/api/accounts', async (req: Request, res: Response) => {
    try {
      // Try to use env vars first, then fall back to headers
      const apiKey = process.env.COINBASE_API_KEY || req.headers['x-api-key'] as string;
      const apiSecret = process.env.COINBASE_API_SECRET || req.headers['x-api-secret'] as string;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const accounts = await coinbaseApi.getAccounts(apiKey, apiSecret);
      res.json(accounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ message: 'Failed to fetch accounts' });
    }
  });

  // Coinbase API Order Endpoints
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const apiSecret = req.headers['x-api-secret'] as string;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const order = await coinbaseApi.createOrder(req.body, apiKey, apiSecret);
      res.status(201).json(order);
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const apiSecret = req.headers['x-api-secret'] as string;
      const { product_id, order_status, limit } = req.query;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const orders = await coinbaseApi.getOrders(
        apiKey, 
        apiSecret, 
        product_id as string, 
        order_status as string, 
        limit as string
      );
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.delete('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const apiKey = req.headers['x-api-key'] as string;
      const apiSecret = req.headers['x-api-secret'] as string;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const result = await coinbaseApi.cancelOrder(orderId, apiKey, apiSecret);
      res.json(result);
    } catch (error) {
      console.error('Error canceling order:', error);
      res.status(500).json({ message: 'Failed to cancel order' });
    }
  });

  // Coinbase API Fill Endpoints
  app.get('/api/fills', async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const apiSecret = req.headers['x-api-secret'] as string;
      const { order_id, product_id, limit } = req.query;
      
      if (!apiKey || !apiSecret) {
        return res.status(401).json({ message: 'API credentials are required' });
      }
      
      const fills = await coinbaseApi.getFills(
        apiKey, 
        apiSecret, 
        order_id as string, 
        product_id as string, 
        limit as string
      );
      res.json(fills);
    } catch (error) {
      console.error('Error fetching fills:', error);
      res.status(500).json({ message: 'Failed to fetch fills' });
    }
  });

  // Favorite Markets
  app.post('/api/favorites', async (req: Request, res: Response) => {
    try {
      // In a real app, you'd get userId from auth session
      const userId = 1; // Placeholder
      const { productId } = req.body;
      
      if (!productId) {
        return res.status(400).json({ message: 'Product ID is required' });
      }
      
      const favorite = await storage.addFavoriteMarket({ userId, productId });
      res.status(201).json(favorite);
    } catch (error) {
      console.error('Error adding favorite market:', error);
      res.status(500).json({ message: 'Failed to add favorite market' });
    }
  });

  app.get('/api/favorites', async (req: Request, res: Response) => {
    try {
      // In a real app, you'd get userId from auth session
      const userId = 1; // Placeholder
      const favorites = await storage.getFavoriteMarkets(userId);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorite markets:', error);
      res.status(500).json({ message: 'Failed to fetch favorite markets' });
    }
  });

  app.delete('/api/favorites/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.removeFavoriteMarket(parseInt(id));
      res.status(204).send();
    } catch (error) {
      console.error('Error removing favorite market:', error);
      res.status(500).json({ message: 'Failed to remove favorite market' });
    }
  });

  // OAuth2 Flow Endpoints
  app.post('/api/oauth/token', async (req: Request, res: Response) => {
    try {
      const { code, redirect_uri } = req.body;
      
      if (!code || !redirect_uri) {
        return res.status(400).json({ message: 'Authorization code and redirect URI are required' });
      }
      
      if (!COINBASE_OAUTH_CLIENT_ID || !COINBASE_OAUTH_CLIENT_SECRET) {
        return res.status(500).json({ message: 'OAuth client credentials are not configured' });
      }
      
      console.log('Attempting to exchange code for token with params:', {
        code: code.substring(0, 5) + '...',
        redirect_uri,
        client_id: COINBASE_OAUTH_CLIENT_ID.substring(0, 5) + '...',
      });
      
      // Exchange code for token with Coinbase according to their documentation
      const tokenResponse = await axios.post(COINBASE_TOKEN_URL, new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: COINBASE_OAUTH_CLIENT_ID,
        client_secret: COINBASE_OAUTH_CLIENT_SECRET,
        redirect_uri
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Return token response to client
      res.json(tokenResponse.data);
    } catch (error) {
      console.error('OAuth token exchange error:', error);
      
      // Get error details from axios error
      let errorMessage = 'Failed to exchange authorization code for token';
      let statusCode = 500;
      
      if (axios.isAxiosError(error) && error.response) {
        statusCode = error.response.status;
        if (error.response.data && error.response.data.error_description) {
          errorMessage = error.response.data.error_description;
        }
      }
      
      res.status(statusCode).json({ message: errorMessage });
    }
  });
  
  app.post('/api/oauth/refresh', async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return res.status(400).json({ message: 'Refresh token is required' });
      }
      
      if (!COINBASE_OAUTH_CLIENT_ID || !COINBASE_OAUTH_CLIENT_SECRET) {
        return res.status(500).json({ message: 'OAuth client credentials are not configured' });
      }
      
      // Exchange refresh token for new access token
      const tokenResponse = await axios.post(COINBASE_TOKEN_URL, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: COINBASE_OAUTH_CLIENT_ID,
        client_secret: COINBASE_OAUTH_CLIENT_SECRET
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Return new tokens to client
      res.json(tokenResponse.data);
    } catch (error) {
      console.error('OAuth token refresh error:', error);
      
      // Get error details from axios error
      let errorMessage = 'Failed to refresh access token';
      let statusCode = 500;
      
      if (axios.isAxiosError(error) && error.response) {
        statusCode = error.response.status;
        if (error.response.data && error.response.data.error_description) {
          errorMessage = error.response.data.error_description;
        }
      }
      
      res.status(statusCode).json({ message: errorMessage });
    }
  });
  
  // Endpoint to validate access token and get user information
  app.get('/api/oauth/user', async (req: Request, res: Response) => {
    try {
      const accessToken = req.headers.authorization?.split('Bearer ')[1];
      
      if (!accessToken) {
        return res.status(401).json({ message: 'Access token is required' });
      }
      
      // Use our OAuth method to get user data from Coinbase API
      const userData = await coinbaseApi.getUserProfile(accessToken);
      res.json(userData);
    } catch (error) {
      console.error('OAuth user data error:', error);
      
      let errorMessage = 'Failed to fetch user data';
      let statusCode = 500;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      res.status(statusCode).json({ message: errorMessage });
    }
  });
  
  // Get user accounts using OAuth
  app.get('/api/oauth/accounts', async (req: Request, res: Response) => {
    try {
      const accessToken = req.headers.authorization?.split('Bearer ')[1];
      
      if (!accessToken) {
        return res.status(401).json({ message: 'Access token is required' });
      }
      
      const accounts = await coinbaseApi.getOAuthAccounts(accessToken);
      res.json(accounts);
    } catch (error) {
      console.error('OAuth accounts error:', error);
      
      let errorMessage = 'Failed to fetch accounts';
      let statusCode = 500;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      res.status(statusCode).json({ message: errorMessage });
    }
  });
  
  // Get account transactions using OAuth
  app.get('/api/oauth/accounts/:accountId/transactions', async (req: Request, res: Response) => {
    try {
      const accessToken = req.headers.authorization?.split('Bearer ')[1];
      const { accountId } = req.params;
      
      if (!accessToken) {
        return res.status(401).json({ message: 'Access token is required' });
      }
      
      const transactions = await coinbaseApi.getOAuthTransactions(accessToken, accountId);
      res.json(transactions);
    } catch (error) {
      console.error('OAuth transactions error:', error);
      
      let errorMessage = 'Failed to fetch transactions';
      let statusCode = 500;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      res.status(statusCode).json({ message: errorMessage });
    }
  });

  return httpServer;
}
