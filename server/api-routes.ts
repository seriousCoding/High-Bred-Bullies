import { Express, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { z } from 'zod';
import { insertApiKeySchema } from '@shared/schema';
import { storage } from './storage';
import { coinbaseClient } from './coinbase-client';
import { keyVault } from './key-vault';
import { oauthService } from './oauth-service';
import { log } from './vite';
import path from 'path';
import fs from 'fs';
import session from 'express-session';

// Extend the Express session to include our custom properties
declare module 'express-session' {
  interface SessionData {
    oauth_state?: string;
  }
}

// Authentication middleware
const apiKeyAuth = async (req: Request, res: Response, next: Function) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const apiSecret = req.headers['x-api-secret'] as string;
    
    if (apiKey && apiSecret) {
      // Set the credentials in the client for this request
      coinbaseClient.setCredentials(apiKey, apiSecret);
      return next();
    }
    
    // Try to get API key from vault using key rotation
    const userId = parseInt(req.headers['x-user-id'] as string) || 0;
    const credentials = await keyVault.getNextKey(userId);
    
    if (credentials) {
      // Set the credentials in the client
      coinbaseClient.setCredentials(credentials.apiKey, credentials.apiSecret);
      
      // Store the key ID in request for later updating its status
      (req as any).keyId = credentials.keyId;
      
      return next();
    }
    
    // No API keys available
    return res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires API credentials. Please add your Coinbase API key and secret.'
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// OAuth token validation middleware
const oauthAuth = (req: Request, res: Response, next: Function) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    
    if (!accessToken) {
      return res.status(401).json({
        error: 'OAuth authentication required',
        message: 'This endpoint requires OAuth authentication. Please connect your Coinbase account.'
      });
    }
    
    // Continue with the request
    next();
  } catch (error) {
    console.error('OAuth middleware error:', error);
    return res.status(500).json({ error: 'OAuth authentication error' });
  }
};

// Register API routes
export async function registerApiRoutes(app: Express, server: HttpServer): Promise<void> {
  // Initialize WebSocket server
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws'
  });
  
  log('Initializing WebSocket server at /ws', 'api');
  
  // Set up WebSocket connection handling
  wss.on('connection', (ws) => {
    log('Client connected to WebSocket', 'ws');
    
    // Handle client messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle subscription requests
        if (data.type === 'subscribe') {
          log(`Received subscription request for ${data.channel}`, 'ws');
          
          try {
            await coinbaseClient.subscribe(data.channel, data.product_ids);
            
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'subscribed',
                channel: data.channel,
                product_ids: data.product_ids
              }));
            }
          } catch (error) {
            console.error('Subscription error:', error);
            
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to subscribe',
                error: error instanceof Error ? error.message : String(error)
              }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message handling error:', error);
      }
    });
    
    ws.on('close', () => {
      log('Client disconnected from WebSocket', 'ws');
    });
  });
  
  // Set up WebSocket forwarding from Coinbase to clients
  coinbaseClient.onMessage((data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  });
  
  // Initialize WebSocket connection to Coinbase
  try {
    await coinbaseClient.connectWebSocket();
  } catch (error) {
    console.error('Failed to connect to Coinbase WebSocket:', error);
  }
  
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
        apiKeyPreview: key.apiKey ? 
          `${key.apiKey.substring(0, 4)}...${key.apiKey.substring(key.apiKey.length - 4)}` :
          'N/A'
      }));
      
      res.json(safeKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ message: 'Failed to fetch API keys' });
    }
  });
  
  app.delete('/api/keys/:id', async (req: Request, res: Response) => {
    try {
      const keyId = parseInt(req.params.id);
      
      if (isNaN(keyId)) {
        return res.status(400).json({ message: 'Invalid key ID' });
      }
      
      await storage.deleteApiKey(keyId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ message: 'Failed to delete API key' });
    }
  });
  
  // OAuth Routes
  app.get('/api/oauth/config', (req: Request, res: Response) => {
    const oauthConfig = oauthService.isOAuthConfigured();
    const redirectUri = `${req.protocol}://${req.headers.host}/auth/redirect`;
    
    // Update the redirect URL in the OAuth service
    oauthService.setRedirectUrl(redirectUri);
    
    res.json({
      ...oauthConfig,
      redirect_uri: redirectUri
    });
  });
  
  app.get('/api/oauth/scopes', (req: Request, res: Response) => {
    const scopes = oauthService.getAvailableScopes();
    res.json(scopes);
  });
  
  app.get('/api/oauth/authorize', (req: Request, res: Response) => {
    try {
      // Extract requested scopes
      const scopeParam = req.query.scope as string;
      const scopes = scopeParam ? scopeParam.split(' ') : ['wallet:accounts:read', 'wallet:user:read'];
      
      // Get authorization URL
      const { url, state } = oauthService.getAuthorizationUrl(scopes);
      
      // Store state in session for later verification
      if (req.session) {
        req.session.oauth_state = state;
      }
      
      res.json({ url, state });
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
      res.status(500).json({ error: 'Failed to generate OAuth URL' });
    }
  });
  
  // OAuth callback handler
  app.get('/auth/redirect', (req: Request, res: Response) => {
    // Serve the redirect HTML page that will post the code to our API
    const htmlPath = path.join(__dirname, 'redirect.html');
    
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      // If the file doesn't exist, generate a simple one
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Coinbase OAuth Redirect</title>
          <script>
            function handleRedirect() {
              const urlParams = new URLSearchParams(window.location.search);
              const code = urlParams.get('code');
              const state = urlParams.get('state');
              const error = urlParams.get('error');
              
              if (error) {
                window.opener.postMessage({ type: 'oauth_error', error }, '*');
                window.close();
                return;
              }
              
              if (code && state) {
                // Send the code to our backend
                fetch('/api/oauth/token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ code, state })
                })
                .then(response => response.json())
                .then(data => {
                  // Send the token back to the opener window
                  window.opener.postMessage({ type: 'oauth_callback', data }, '*');
                  window.close();
                })
                .catch(error => {
                  window.opener.postMessage({ type: 'oauth_error', error: error.toString() }, '*');
                  window.close();
                });
              } else {
                window.opener.postMessage({ type: 'oauth_error', error: 'Missing code or state parameter' }, '*');
                window.close();
              }
            }
            
            // Call the function when the page loads
            window.onload = handleRedirect;
          </script>
        </head>
        <body>
          <h1>Processing Coinbase OAuth...</h1>
          <p>Please wait while we complete the authentication process.</p>
        </body>
        </html>
      `;
      
      res.send(html);
    }
  });
  
  // Token exchange endpoint
  app.post('/api/oauth/token', async (req: Request, res: Response) => {
    try {
      const { code, state } = req.body;
      
      // Verify state parameter
      if (req.session?.oauth_state !== state) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }
      
      // Exchange code for token
      const token = await oauthService.exchangeCodeForToken(code);
      
      res.json({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
        token_type: token.token_type,
        scope: token.scope
      });
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      res.status(500).json({
        error: 'Failed to exchange code for token',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Token refresh endpoint
  app.post('/api/oauth/refresh', async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }
      
      // Refresh the token
      const token = await oauthService.refreshToken(refresh_token);
      
      res.json({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
        token_type: token.token_type,
        scope: token.scope
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      res.status(500).json({
        error: 'Failed to refresh token',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Token revocation endpoint
  app.post('/api/oauth/revoke', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }
      
      // Revoke the token
      const success = await oauthService.revokeToken(token);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to revoke token' });
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      res.status(500).json({
        error: 'Failed to revoke token',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Advanced Trade API - Products & Market Data
  app.get('/api/products', async (req: Request, res: Response) => {
    try {
      // Get products without requiring authentication
      const products = await coinbaseClient.getProducts();
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get('/api/products/:productId/details', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      
      // Get detailed product information with current pricing
      const productDetails = await coinbaseClient.getProductDetails([productId]);
      
      if (productDetails.length > 0) {
        res.json(productDetails[0]);
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    } catch (error) {
      console.error(`Error fetching details for ${req.params.productId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch product details',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get('/api/products/:productId/trades', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const trades = await coinbaseClient.getProductTrades(productId, limit);
      res.json(trades);
    } catch (error) {
      console.error(`Error fetching trades for ${req.params.productId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch trades',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get('/api/products/:productId/book', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const level = parseInt(req.query.level as string) || 2;
      
      const orderBook = await coinbaseClient.getProductOrderBook(productId, level);
      res.json(orderBook);
    } catch (error) {
      console.error(`Error fetching order book for ${req.params.productId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch order book',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get('/api/products/:productId/candles', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const start = req.query.start as string;
      const end = req.query.end as string;
      const granularity = parseInt(req.query.granularity as string) || 3600;
      
      if (!start || !end) {
        return res.status(400).json({
          error: 'Missing parameters',
          message: 'start and end parameters are required'
        });
      }
      
      const candles = await coinbaseClient.getProductCandles(
        productId,
        start,
        end,
        granularity
      );
      
      res.json(candles);
    } catch (error) {
      console.error(`Error fetching candles for ${req.params.productId}:`, error);
      res.status(500).json({
        error: 'Failed to fetch candles',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Advanced Trade API - Account Endpoints (require authentication)
  app.get('/api/accounts', apiKeyAuth, async (req: Request, res: Response) => {
    try {
      const accounts = await coinbaseClient.getAccounts();
      
      // Update key status on success
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, true);
      }
      
      res.json(accounts);
    } catch (error) {
      // Update key status on failure
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, false);
      }
      
      console.error('Error fetching accounts:', error);
      res.status(500).json({
        error: 'Failed to fetch accounts',
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Clear credentials from the client
      coinbaseClient.clearCredentials();
    }
  });
  
  // Advanced Trade API - Order Endpoints (require authentication)
  app.post('/api/orders', apiKeyAuth, async (req: Request, res: Response) => {
    try {
      const order = await coinbaseClient.createOrder(req.body);
      
      // Update key status on success
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, true);
      }
      
      res.status(201).json(order);
    } catch (error) {
      // Update key status on failure
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, false);
      }
      
      console.error('Error creating order:', error);
      res.status(500).json({
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Clear credentials from the client
      coinbaseClient.clearCredentials();
    }
  });
  
  app.get('/api/orders', apiKeyAuth, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      const orders = await coinbaseClient.getOrders(limit);
      
      // Update key status on success
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, true);
      }
      
      res.json(orders);
    } catch (error) {
      // Update key status on failure
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, false);
      }
      
      console.error('Error fetching orders:', error);
      res.status(500).json({
        error: 'Failed to fetch orders',
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Clear credentials from the client
      coinbaseClient.clearCredentials();
    }
  });
  
  app.delete('/api/orders/:orderId', apiKeyAuth, async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      
      const success = await coinbaseClient.cancelOrder(orderId);
      
      // Update key status on success
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, true);
      }
      
      res.json({ success });
    } catch (error) {
      // Update key status on failure
      if ((req as any).keyId) {
        await keyVault.updateKeyStatus((req as any).keyId, false);
      }
      
      console.error(`Error cancelling order ${req.params.orderId}:`, error);
      res.status(500).json({
        error: 'Failed to cancel order',
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Clear credentials from the client
      coinbaseClient.clearCredentials();
    }
  });
  
  // Coinbase Core API (OAuth) - User endpoints
  app.get('/api/user', oauthAuth, async (req: Request, res: Response) => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1] as string;
      
      const userProfile = await coinbaseClient.getUserProfile(accessToken);
      res.json(userProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        error: 'Failed to fetch user profile',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Coinbase Core API (OAuth) - Accounts endpoints
  app.get('/api/oauth/accounts', oauthAuth, async (req: Request, res: Response) => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1] as string;
      
      const accounts = await coinbaseClient.getOAuthAccounts(accessToken);
      res.json(accounts);
    } catch (error) {
      console.error('Error fetching OAuth accounts:', error);
      res.status(500).json({
        error: 'Failed to fetch accounts',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: true,
        websocket: !!wss,
        oauth: oauthService.isOAuthConfigured().configured,
        database: !!storage
      }
    });
  });
  
  log('API routes registered successfully', 'api');
}