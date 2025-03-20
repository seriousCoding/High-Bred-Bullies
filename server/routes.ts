import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { coinbaseApi } from "./coinbase-api";
import { z } from "zod";
import { insertApiKeySchema } from "@shared/schema";
import { WebSocketServer } from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// OAuth configuration - using environment variables for secure access
const COINBASE_OAUTH_CLIENT_ID = process.env.COINBASE_OAUTH_CLIENT_ID;
const COINBASE_OAUTH_CLIENT_SECRET = process.env.COINBASE_OAUTH_CLIENT_SECRET;
// We should not hardcode any OAuth credentials, use environment variables only
const COINBASE_OAUTH_CLIENT_ID_ALT = process.env.COINBASE_OAUTH_CLIENT_ID_ALT;
const COINBASE_OAUTH_CLIENT_SECRET_ALT = process.env.COINBASE_OAUTH_CLIENT_SECRET_ALT;
const COINBASE_CLIENT_API_KEY = process.env.COINBASE_CLIENT_API_KEY; // Client API key for UI access
const COINBASE_AUTH_URL = 'https://login.coinbase.com/oauth2/auth';
const COINBASE_TOKEN_URL = 'https://login.coinbase.com/oauth2/token';

// Debug OAuth configuration
console.log("OAuth server configuration:", {
  client_id_available: !!COINBASE_OAUTH_CLIENT_ID,
  client_secret_available: !!COINBASE_OAUTH_CLIENT_SECRET
});

// Create a custom axios instance that ignores SSL certificate validation issues
// This can help bypass some environment restrictions when connecting to external APIs
const coinbaseAxios = axios.create({
  timeout: 30000, // 30 seconds
  httpsAgent: new https.Agent({ 
    rejectUnauthorized: false  // This is a workaround for certificate validation issues
  })
});

import { setupUnifiedAuth, requireAuth } from './unified-auth';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup unified Coinbase authentication
  setupUnifiedAuth(app);

  // Setup WebSocket server for real-time data with specific path
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  // Handle WebSocket connections with rate limiting
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Track subscription requests to implement rate limiting
    const subscriptionQueue: any[] = [];
    let isProcessingQueue = false;
    
    // Process subscriptions one at a time with delay to prevent rate limiting
    const processSubscriptionQueue = async () => {
      if (subscriptionQueue.length === 0 || isProcessingQueue) {
        return;
      }
      
      isProcessingQueue = true;
      
      try {
        const data = subscriptionQueue.shift();
        console.log(`Processing subscription request for channel: ${data.channel || 'unknown'}`);
        
        // Forward subscription to Coinbase
        const subscriptionResult = await coinbaseApi.subscribeToFeed(data);
        
        // Send result back to client
        if (ws.readyState === 1) { // WebSocket.OPEN = 1
          ws.send(JSON.stringify(subscriptionResult));
        }
        
        // Wait 1 second between subscriptions to avoid rate limiting
        setTimeout(() => {
          isProcessingQueue = false;
          processSubscriptionQueue(); // Process next item in queue
        }, 1000);
      } catch (error) {
        console.error('Failed to process subscription:', error);
        isProcessingQueue = false;
        
        // Continue processing other items even if one fails
        setTimeout(processSubscriptionQueue, 1000);
      }
    };
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle subscription requests
        if (data.type === 'subscribe') {
          console.log(`Processing subscription for channel: ${data.channel || 'unknown'}`);
          
          // Special handling for heartbeat channel - immediately respond with success
          if (data.channel === 'heartbeat') {
            console.log('Heartbeat subscription received - acknowledging');
            ws.send(JSON.stringify({
              type: 'subscribed',
              channel: 'heartbeat',
              product_ids: data.product_ids || []
            }));
            
            // Add to queue for actual subscription to Coinbase
            subscriptionQueue.push(data);
            // Start processing queue if not already processing
            if (!isProcessingQueue) {
              processSubscriptionQueue();
            }
            return;
          }
          
          // Check if this is an authenticated channel requiring signature
          if (data.channel === 'user') {
            // Extract API key and API secret from headers or environment variables
            // Use environment variables if available to ensure we have access to secrets
            const apiKey = process.env.COINBASE_API_KEY;
            const apiSecret = process.env.COINBASE_API_SECRET;
            
            if (!apiKey || !apiSecret) {
              console.error('Cannot authenticate WebSocket: Missing API credentials');
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Missing API credentials for authenticated channel' 
              }));
              return;
            }
            
            // Calculate the timestamp (seconds since Unix epoch)
            const timestamp = Math.floor(Date.now() / 1000).toString();
            
            // Create the message to sign per Advanced Trade API docs
            const signatureMessage = timestamp + 'GET' + '/ws';
            
            // Create the signature using HMAC-SHA256 and base64 encoding
            const crypto = require('crypto');
            const signature = crypto
              .createHmac('sha256', apiSecret)
              .update(signatureMessage)
              .digest('base64');
            
            // Create authenticated message
            const authMessage = {
              type: 'subscribe',
              channel: 'user',
              api_key: apiKey,
              timestamp: timestamp,
              signature: signature
            };
            
            // Replace the original message with authenticated one
            subscriptionQueue.push(authMessage);
          } else {
            // For public channels, use the message as-is
            subscriptionQueue.push(data);
          }
          
          // Start processing queue if not already running
          if (!isProcessingQueue) {
            processSubscriptionQueue();
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        if (ws.readyState === 1) { // WebSocket.OPEN = 1
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  // Forward real-time data from Coinbase to connected clients
  coinbaseApi.onMessage((data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // client.OPEN = 1
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
      const userId = parseInt(req.headers['x-user-id'] as string) || 0;
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
      // Get API credentials from environment or headers
      const apiKey = process.env.COINBASE_API_KEY || req.headers['x-api-key'] as string;
      const apiSecret = process.env.COINBASE_API_SECRET || req.headers['x-api-secret'] as string;
      
      // Log the API request details
      console.log(`Products API request received`);
      
      // Try authenticated endpoint if we have credentials
      if (apiKey && apiSecret) {
        console.log(`Using authenticated API with key ${apiKey.substring(0, 4)}...`);
        console.log('Calling Coinbase Advanced API products endpoint with auth credentials');
        try {
          const products = await coinbaseApi.getProducts(apiKey, apiSecret);
          
          // Log response details for debugging
          console.log(`Authenticated products endpoint returned ${products.length} items`);
          if (products.length > 0) {
            console.log(`Sample product: ${JSON.stringify(products[0]).slice(0, 150)}...`);
          }
          
          return res.json(products);
        } catch (authError) {
          console.error('Authentication error calling products API:', authError);
          // Let the code fall through to try public API
        }
      }
      
      // If no credentials or auth failed, use public API
      console.log('Using public API for product data');
      const publicProducts = await coinbaseApi.getPublicProducts();
      
      // Log response details
      console.log(`Public products endpoint returned ${publicProducts.length} items`);
      if (publicProducts.length > 0) {
        console.log(`Sample public product: ${JSON.stringify(publicProducts[0]).slice(0, 150)}...`);
      }
      
      return res.json(publicProducts);
    } catch (error) {
      // Log the full error details
      console.error('Error fetching products from Coinbase API:', error);
      
      // Return error response to client
      return res.status(500).json({ 
        message: 'Failed to fetch products from Coinbase API',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Product Trades Endpoint - using Coinbase Exchange API (public, no auth needed)
  app.get('/api/products/:productId/trades', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      
      console.log(`Trades API request received for ${productId}`);
      
      try {
        // Use the getProductTrades method which uses Coinbase Exchange API (no auth needed)
        const trades = await coinbaseApi.getProductTrades(productId, limit);
        console.log(`Successfully fetched ${trades.length} trades for ${productId}`);
        return res.json(trades);
      } catch (error) {
        console.error(`Error fetching trades for ${productId}:`, error);
        
        // Return empty array instead of error for better UI handling
        return res.json([]);
      }
    } catch (error) {
      console.error('Error in trades endpoint:', error);
      return res.json([]);
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
      
      try {
        const orderBook = await coinbaseApi.getProductBook(productId, apiKey, apiSecret);
        return res.json(orderBook);
      } catch (authError) {
        console.error('Authentication or API error for order book endpoint:', authError);
        return res.status(500).json({ 
          error: 'Failed to fetch authentic order book data from Coinbase',
          message: 'No fallback data is available. Only authentic Coinbase data can be used.',
          productId
        });
      }
    } catch (error) {
      console.error('Error fetching order book:', error);
      return res.status(500).json({
        error: 'Failed to process order book request',
        message: 'An unexpected error occurred while fetching order book data',
        productId: req.params.productId
      });
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
      
      try {
        const candles = await coinbaseApi.getCandles(
          productId, 
          apiKey, 
          apiSecret, 
          start as string, 
          end as string, 
          granularity as string
        );
        return res.json(candles);
      } catch (authError) {
        console.error('Authentication or API error for candles endpoint:', authError);
        return res.status(500).json({ 
          error: 'Failed to fetch authentic candle data from Coinbase',
          message: 'No fallback data is available. Only authentic Coinbase data can be used.',
          productId
        });
      }
    } catch (error) {
      console.error('Error fetching candles:', error);
      return res.status(500).json({
        error: 'Failed to process candles request',
        message: 'An unexpected error occurred while fetching candle data',
        productId: req.params.productId
      });
    }
  });

  // Coinbase API Account Endpoints
  app.get('/api/accounts', async (req: Request, res: Response) => {
    try {
      // For now, use user ID 1 for simplicity since we haven't implemented full user auth
      const userId = parseInt(req.headers['x-user-id'] as string) || 0;
      
      try {
        console.log('Fetching accounts using API key rotation system...');
        const accounts = await coinbaseApi.getAccountsWithRotation(userId);
        
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          console.log(`Successfully retrieved ${accounts.length} accounts from Coinbase`);
          return res.json(accounts);
        } else {
          console.error('No accounts returned from Coinbase API');
          return res.status(500).json({ 
            message: 'No accounts found. Please check your API credentials and ensure they have the required permissions.'
          });
        }
      } catch (error) {
        console.error('Authentication failed for accounts endpoint:', error);
        return res.status(401).json({ 
          message: 'Failed to authenticate with Coinbase. Please check your API credentials and ensure they have the required permissions.'
        });
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return res.status(500).json({ message: 'An error occurred while fetching accounts' });
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
      
      try {
        console.log('Fetching orders from Coinbase API...');
        const orders = await coinbaseApi.getOrders(
          apiKey, 
          apiSecret, 
          product_id as string, 
          order_status as string, 
          limit as string
        );
        
        if (orders && Array.isArray(orders)) {
          console.log(`Successfully retrieved ${orders.length} orders from Coinbase`);
          return res.json(orders);
        } else {
          console.error('No orders returned from Coinbase API');
          return res.status(404).json({ 
            message: 'No orders found. You may not have any open orders for this product.'
          });
        }
      } catch (error) {
        console.error('Authentication failed for orders endpoint:', error);
        return res.status(401).json({ 
          message: 'Failed to authenticate with Coinbase. Please check your API credentials and ensure they have the required permissions.'
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ message: 'An error occurred while fetching orders' });
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
      
      try {
        console.log('Fetching fills from Coinbase API...');
        const fills = await coinbaseApi.getFills(
          apiKey, 
          apiSecret, 
          order_id as string, 
          product_id as string, 
          limit as string
        );
        
        if (fills && Array.isArray(fills)) {
          console.log(`Successfully retrieved ${fills.length} fills from Coinbase`);
          return res.json(fills);
        } else {
          console.error('No fills returned from Coinbase API');
          return res.status(404).json({ 
            message: 'No fills found. You may not have any trading history for this product.'
          });
        }
      } catch (authError) {
        console.error('Authentication failed for fills endpoint:', authError);
        return res.status(401).json({ 
          message: 'Failed to authenticate with Coinbase. Please check your API credentials and ensure they have the required permissions.'
        });
      }
    } catch (error) {
      console.error('Error fetching fills:', error);
      return res.status(500).json({ message: 'An error occurred while fetching fills' });
    }
  });

  // Favorite Markets
  app.post('/api/favorites', async (req: Request, res: Response) => {
    try {
      // In a real app, you'd get userId from auth session
      const userId = parseInt(req.headers['x-user-id'] as string) || 0;
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
      const userId = parseInt(req.headers['x-user-id'] as string) || 0;
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
  
  // Direct proxy to Coinbase OAuth - helps bypass CORS/connection restrictions
  app.get('/api/oauth/proxy', async (req: Request, res: Response) => {
    try {
      console.log("---------------------------------------------");
      console.log("SERVER-SIDE OAUTH PROXY INITIATED");
      
      const authUrl = req.query.auth_url as string;
      if (!authUrl) {
        return res.status(400).json({ message: 'Auth URL is required' });
      }
      
      console.log("Making server-side request to Coinbase:", authUrl.substring(0, 60) + "...");
      
      // Make a direct server-to-server request to Coinbase
      const response = await coinbaseAxios.get(authUrl, {
        maxRedirects: 0, // Don't follow redirects
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      // Return the response or redirect URL
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        console.log("Received redirect response. Location:", response.headers.location);
        return res.json({ redirect_url: response.headers.location });
      }
      
      console.log("Proxied request successful with status:", response.status);
      // If it's not a redirect, return the HTML content
      res.send(response.data);
    } catch (error) {
      console.error("OAuth proxy error:", error);
      res.status(500).json({ 
        message: 'Failed to proxy OAuth request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // HTML redirect page for OAuth
  app.get('/auth/redirect', async (req: Request, res: Response) => {
    try {
      console.log("---------------------------------------------");
      console.log("SERVING ENHANCED OAUTH REDIRECT PAGE");
      
      const authUrl = req.query.auth_url as string;
      const state = req.query.state as string;
      
      if (!authUrl || !state) {
        return res.status(400).send('Missing required parameters: auth_url and state');
      }
      
      // Store state in a cookie for CSRF protection
      res.cookie('auth_state', state, { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      
      console.log("Auth URL:", authUrl);
      console.log("State:", state);
      
      // Try to get the actual redirect URL from Coinbase's servers
      let redirectUrl = authUrl;
      
      try {
        // Use the server to proxy the request and get the redirect URL
        console.log("Attempting to get actual redirect URL from Coinbase...");
        
        const proxyResponse = await coinbaseAxios.get(authUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400
        });
        
        // If we got a redirect response, extract the location header
        if (proxyResponse.headers.location) {
          redirectUrl = proxyResponse.headers.location;
          console.log("Successfully retrieved redirect URL:", redirectUrl);
        }
      } catch (error: any) {
        if (error.response && error.response.headers && error.response.headers.location) {
          // Even an error response might have a redirect location
          redirectUrl = error.response.headers.location;
          console.log("Retrieved redirect URL from error response:", redirectUrl);
        } else {
          console.log("Could not get redirect URL, using original auth URL");
        }
      }
      
      // Create inline HTML for the redirect page - this avoids file system issues
      let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting to Coinbase...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      background-color: #f7f9fc;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #333;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 500px;
      text-align: center;
    }
    .logo {
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #0052ff;
    }
    p {
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }
    .countdown {
      font-size: 2rem;
      font-weight: bold;
      margin: 1rem 0;
      color: #0052ff;
    }
    .button {
      background-color: #0052ff;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background-color 0.2s;
      text-decoration: none;
      display: inline-block;
      margin-top: 1rem;
    }
    .button:hover {
      background-color: #0039cb;
    }
    .footer {
      margin-top: 2rem;
      font-size: 0.9rem;
      color: #666;
    }
    .backup-area {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #eee;
    }
    .backup-link {
      word-break: break-all;
      font-family: monospace;
      background-color: #f5f5f5;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      margin: 0.5rem 0;
      display: block;
    }
    .hide {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg width="100" height="24" viewBox="0 0 100 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.7963 0C5.2963 0 0 5.28 0 11.76C0 18.24 5.2963 23.52 11.7963 23.52C18.2963 23.52 23.5926 18.24 23.5926 11.76C23.5926 5.28 18.2963 0 11.7963 0ZM11.7963 17.76C8.3889 17.76 5.5926 14.88 5.5926 11.52C5.5926 8.16 8.3889 5.28 11.7963 5.28C15.2037 5.28 18 8.16 18 11.52C18 14.88 15.2037 17.76 11.7963 17.76Z" fill="#0052FF"/>
        <path d="M29.9259 4.8H34.8148V18.72H29.9259V4.8Z" fill="#0052FF"/>
        <path d="M29.9259 0H34.8148V3.84H29.9259V0Z" fill="#0052FF"/>
        <path d="M42.5926 13.44C42.5926 10.8 43.7037 9.36 45.963 9.36C48.2222 9.36 49.3333 10.8 49.3333 13.44C49.3333 16.08 48.2222 17.52 45.963 17.52C43.7037 17.52 42.5926 16.08 42.5926 13.44ZM37.7037 13.44C37.7037 18.72 40.3333 22.08 45.963 22.08C51.5926 22.08 54.2222 18.72 54.2222 13.44C54.2222 8.16 51.5926 4.8 45.963 4.8C40.3333 4.8 37.7037 8.16 37.7037 13.44Z" fill="#0052FF"/>
        <path d="M55.5556 13.44C55.5556 18.72 58.1851 22.08 63.8148 22.08C69.4444 22.08 72.0741 18.72 72.0741 13.44C72.0741 8.16 69.4444 4.8 63.8148 4.8C58.1851 4.8 55.5556 8.16 55.5556 13.44ZM60.4444 13.44C60.4444 10.8 61.5556 9.36 63.8148 9.36C66.0741 9.36 67.1852 10.8 67.1852 13.44C67.1852 16.08 66.0741 17.52 63.8148 17.52C61.5556 17.52 60.4444 16.08 60.4444 13.44Z" fill="#0052FF"/>
        <path d="M80.2963 10.56V18.72H75.4074V4.8H80.2963V6.96C81.4074 5.28 83.1111 4.8 84.7407 4.8H86.2963V9.36H84.7407C82 9.36 80.2963 10.08 80.2963 10.56Z" fill="#0052FF"/>
        <path d="M87.7778 13.44C87.7778 18.72 90.4074 22.32 95.1111 22.32C98.2963 22.32 100 21.12 100 18.72V4.8H95.1111V17.04C95.1111 17.52 94.5185 18 93.5556 18C91.7778 18 92.6667 16.56 92.6667 13.44C92.6667 8.4 91.7778 6 87.7778 4.8V13.44Z" fill="#0052FF"/>
      </svg>
    </div>
    
    <h1>Redirecting to Coinbase</h1>
    <p>You'll be redirected to Coinbase in <span id="countdown" class="countdown">5</span> seconds...</p>
    <p>If you're not redirected automatically, please click the button below:</p>
    
    <a href="#" id="manual-redirect" class="button">Go to Coinbase</a>
    
    <div class="footer">
      <p>This page will redirect you to Coinbase to complete the authorization process.</p>
    </div>
    
    <div id="backup-area" class="backup-area hide">
      <h3>Backup Options</h3>
      <p>If the automatic redirect doesn't work, try copying and pasting the following URL into your browser:</p>
      <pre id="url-display" class="backup-link"></pre>
    </div>
  </div>

  <script>
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Set these values from the route's parsed parameters
    const authUrl = urlParams.get('auth_url');
    let redirectUrl = urlParams.get('redirect_url');
    
    // If we got a redirectUrl directly, use it, otherwise use authUrl as fallback
    const finalRedirectUrl = redirectUrl || authUrl;
    
    // Update the manual redirect button
    const manualRedirectButton = document.getElementById('manual-redirect');
    manualRedirectButton.href = finalRedirectUrl;
    
    // Show the URL in the backup section
    const urlDisplay = document.getElementById('url-display');
    if (urlDisplay) {
      urlDisplay.textContent = finalRedirectUrl;
    }
    
    // Optional: Show backup area after a delay, assuming redirect failed
    setTimeout(() => {
      const backupArea = document.getElementById('backup-area');
      if (backupArea) {
        backupArea.classList.remove('hide');
      }
    }, 10000); // Show after 10 seconds
    
    // Set up automatic redirect with countdown
    let remainingSeconds = 5;
    const countdownElement = document.getElementById('countdown');
    
    const countdownInterval = setInterval(() => {
      remainingSeconds--;
      countdownElement.textContent = remainingSeconds;
      
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        
        // Try the redirect
        try {
          console.log("Auto-redirecting to:", finalRedirectUrl);
          window.location.href = finalRedirectUrl;
        } catch (e) {
          console.error("Redirect failed:", e);
        }
      }
    }, 1000);
    
    // Also try opening in a popup as an alternative strategy
    setTimeout(() => {
      try {
        const popup = window.open(finalRedirectUrl, "_blank");
        
        // If popup failed or was blocked, we'll rely on the main redirect approach
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          console.log("Popup was blocked, continuing with main approach");
        }
      } catch (e) {
        console.error("Popup approach failed:", e);
      }
    }, 2000); // Try popup after 2 seconds
  </script>
</body>
</html>
      `;
      
      // Replace placeholders in the HTML file
      html = html.replace('const authUrl = urlParams.get(\'auth_url\');', 
        `const authUrl = "${authUrl.replace(/"/g, '\\"')}";`);
      html = html.replace('let redirectUrl = urlParams.get(\'redirect_url\');', 
        `let redirectUrl = "${redirectUrl.replace(/"/g, '\\"')}";`);
      
      // Set appropriate headers and send the HTML page
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      
      console.log("Enhanced HTML redirect page served successfully");
      console.log("---------------------------------------------");
    } catch (error) {
      console.error("Error serving enhanced redirect HTML:", error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // OAuth initialization proxy endpoint
  /// OAuth routes moved to oauthRouter

  return httpServer;
}
