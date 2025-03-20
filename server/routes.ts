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

// Load environment variables
dotenv.config();

// OAuth configuration
const COINBASE_OAUTH_CLIENT_ID = process.env.COINBASE_OAUTH_CLIENT_ID;
const COINBASE_OAUTH_CLIENT_SECRET = process.env.COINBASE_OAUTH_CLIENT_SECRET;
const COINBASE_AUTH_URL = 'https://login.coinbase.com/oauth2/auth';
const COINBASE_TOKEN_URL = 'https://login.coinbase.com/oauth2/token';

// Debug OAuth configuration

// Create a custom axios instance that ignores SSL certificate validation issues
// This can help bypass some environment restrictions when connecting to external APIs
const coinbaseAxios = axios.create({
  timeout: 30000, // 30 seconds
  httpsAgent: new https.Agent({ 
    rejectUnauthorized: false  // This is a workaround for certificate validation issues
  })
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
  app.get('/auth/redirect', (req: Request, res: Response) => {
    try {
      console.log("---------------------------------------------");
      console.log("SERVING OAUTH REDIRECT HTML PAGE");
      
      const authUrl = req.query.auth_url as string;
      const state = req.query.state as string;
      
      if (!authUrl || !state) {
        return res.status(400).send('Missing required parameters: auth_url and state');
      }
      
      // Create a simple HTML page that will redirect the user to Coinbase
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting to Coinbase...</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <script>
          // Store the state in localStorage for CSRF protection
          localStorage.setItem("auth_state_key", "${state}");
          
          // Try multiple approaches to navigate to Coinbase
          function navigateToCoinbase() {
            console.log("Attempting to navigate to Coinbase with URL: ${authUrl}");
            
            try {
              // Method 1: Standard window.location redirect
              window.location.href = "${authUrl}";
            } catch (e) {
              console.error("Method 1 failed:", e);
              
              try {
                // Method 2: Open in new tab/window
                window.open("${authUrl}", "_blank");
              } catch (e2) {
                console.error("Method 2 failed:", e2);
                
                try {
                  // Method 3: Use a form submission
                  document.getElementById('coinbase-form').submit();
                } catch (e3) {
                  console.error("Method 3 failed:", e3);
                  document.getElementById('manual-instructions').style.display = 'block';
                }
              }
            }
          }
          
          // Execute after a short delay
          setTimeout(navigateToCoinbase, 1000);
        </script>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #1a1b1e;
            color: #eaeaea;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            max-width: 600px;
            padding: 40px;
            background-color: #272a30;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          }
          h1 {
            color: #0052FF;
            margin-bottom: 20px;
          }
          p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .logo {
            width: 180px;
            margin-bottom: 30px;
          }
          .spinner {
            border: 4px solid rgba(0, 82, 255, 0.2);
            border-left: 4px solid #0052FF;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="https://www.coinbase.com/assets/logos/coinbase.svg" alt="Coinbase Logo" class="logo">
          <h1>Redirecting to Coinbase...</h1>
          <p>You will be redirected to Coinbase to authorize this application. Please wait a moment.</p>
          <div class="spinner"></div>
          <p>If you are not redirected automatically, <a href="${authUrl}" style="color: #0052FF;" target="_blank">click here</a>.</p>
          
          <div id="manual-instructions" style="display: none; margin-top: 30px; padding: 15px; background-color: #333; border-radius: 5px;">
            <h3 style="color: #0052FF;">Manual Connection Instructions</h3>
            <p>If automatic redirection fails, please follow these steps:</p>
            <ol style="text-align: left; padding-left: 30px;">
              <li>Copy the full Coinbase authorization URL below</li>
              <li>Open a new browser tab</li>
              <li>Paste and navigate to the URL</li>
              <li>Authorize access when prompted by Coinbase</li>
            </ol>
            <textarea style="width: 100%; height: 60px; margin: 10px 0; background: #222; color: #eaeaea; border: 1px solid #555; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px;">${authUrl}</textarea>
            <button onclick="navigator.clipboard.writeText('${authUrl}').then(() => alert('URL copied to clipboard!'))" style="background-color: #0052FF; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-top: 5px;">Copy URL</button>
          </div>
        </div>
        
        <!-- Hidden form for method 3 -->
        <form id="coinbase-form" action="${authUrl}" method="get" style="display:none"></form>
      </body>
      </html>
      `;
      
      // Set appropriate headers and send the HTML page
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      
      console.log("HTML redirect page served successfully");
      console.log("---------------------------------------------");
    } catch (error) {
      console.error("Error serving redirect HTML:", error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // OAuth initialization proxy endpoint
  app.get('/api/oauth/init', (req: Request, res: Response) => {
    try {
      console.log("---------------------------------------------");
      console.log("SERVER-SIDE OAUTH INITIALIZATION");
      
      if (!COINBASE_OAUTH_CLIENT_ID) {
        console.error("Missing OAuth client ID in server configuration");
        return res.status(500).json({ message: 'OAuth client credentials are not configured' });
      }
      
      // Generate state for CSRF protection - must be at least 8 characters long per docs
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Build the redirect URL
      const redirectUri = req.query.redirect_uri as string;
      if (!redirectUri) {
        return res.status(400).json({ message: 'Redirect URI is required' });
      }
      
      console.log("Initializing OAuth with redirect URI:", redirectUri);
      
      // Create authorization URL - exactly as specified in the Coinbase docs
      const authUrl = new URL("https://login.coinbase.com/oauth2/auth");
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("client_id", COINBASE_OAUTH_CLIENT_ID);
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("state", state);
      
      // Add required scopes - using comma separation as specified in the docs
      const scopes = [
        "wallet:accounts:read",
        "wallet:user:read",
        "wallet:buys:read",
        "wallet:sells:read",
        "wallet:transactions:read",
        "wallet:payment-methods:read",
        "wallet:addresses:read",
        "wallet:orders:read",
        "wallet:orders:create",
        "wallet:orders:update",
        "wallet:trades:read",
        "offline_access"
      ];
      authUrl.searchParams.append("scope", scopes.join(","));
      
      // Return auth URL and state
      console.log("Generated OAuth URL:", authUrl.toString().substring(0, 60) + "...");
      console.log("---------------------------------------------");
      
      res.json({ 
        auth_url: authUrl.toString(),
        state
      });
    } catch (error) {
      console.error("Error initializing OAuth:", error);
      res.status(500).json({ message: 'Failed to initialize OAuth flow' });
    }
  });
  
  app.post('/api/oauth/token', async (req: Request, res: Response) => {
    try {
      console.log('---------------------------------------------');
      console.log('OAUTH TOKEN EXCHANGE - START');
      console.log('Received request body:', JSON.stringify(req.body, null, 2));
      
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
      console.log('Making token exchange request to Coinbase...');
      
      const payload = {
        grant_type: 'authorization_code',
        code,
        client_id: COINBASE_OAUTH_CLIENT_ID,
        client_secret: COINBASE_OAUTH_CLIENT_SECRET,
        redirect_uri
      };
      
      console.log('Request payload structure:', Object.keys(payload));
      
      const tokenResponse = await axios.post(
        COINBASE_TOKEN_URL, 
        new URLSearchParams(payload), 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );
      
      // Return token response to client
      res.json(tokenResponse.data);
    } catch (error) {
      console.error('---------------------------------------------');
      console.error('OAUTH TOKEN EXCHANGE - ERROR');
      console.error('OAuth token exchange error:', error);
      
      // Get error details from axios error
      let errorMessage = 'Failed to exchange authorization code for token';
      let statusCode = 500;
      let errorDetails = {};
      
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          headers: error.response?.headers,
          data: error.response?.data
        });
        
        if (error.response) {
          statusCode = error.response.status;
          errorDetails = error.response.data || {};
          
          if (error.response.data && error.response.data.error_description) {
            errorMessage = error.response.data.error_description;
          } else if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        }
      }
      
      console.error('Responding with error:', {
        statusCode,
        errorMessage,
        errorDetails
      });
      console.error('---------------------------------------------');
      
      res.status(statusCode).json({ 
        message: errorMessage,
        details: errorDetails
      });
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
      console.log('Making refresh token request to Coinbase...');
      
      const payload = {
        grant_type: 'refresh_token',
        refresh_token,
        client_id: COINBASE_OAUTH_CLIENT_ID,
        client_secret: COINBASE_OAUTH_CLIENT_SECRET
      };
      
      console.log('Refresh request payload structure:', Object.keys(payload));
      
      const tokenResponse = await axios.post(
        COINBASE_TOKEN_URL, 
        new URLSearchParams(payload), 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );
      
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
