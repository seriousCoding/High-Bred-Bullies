import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import axios from 'axios';
import dotenv from 'dotenv';
import { coinbaseApi } from './coinbase-api';
import { storage } from './storage';

// Extend session for OAuth token storage
declare module 'express-session' {
  interface SessionData {
    access_token?: string;
    authenticated?: boolean;
    oauth_state?: string;
  }
}

/**
 * Setup unified authentication routes for Coinbase
 */
export function setupUnifiedAuth(app: Express) {
  // Redirect to Coinbase OAuth login
  app.get("/auth/login", (req: Request, res: Response) => {
    // Generate a random state value for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    req.session.oauth_state = state;
    
    // Redirect to Coinbase authorization page
    const clientId = process.env.COINBASE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.APP_URL || req.protocol + '://' + req.get('host')}/auth/callback`;
    const scopes = 'wallet:accounts:read,wallet:user:read';
    
    const authUrl = `https://www.coinbase.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes}`;
    
    res.redirect(authUrl);
  });

  // Handle OAuth callback
  app.get("/auth/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    
    // Verify state to prevent CSRF attacks
    if (state !== req.session.oauth_state) {
      return res.status(400).send("Invalid state parameter");
    }
    
    try {
      // Exchange code for access token
      const clientId = process.env.COINBASE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.COINBASE_OAUTH_CLIENT_SECRET;
      const redirectUri = `${process.env.APP_URL || req.protocol + '://' + req.get('host')}/auth/callback`;
      
      const tokenResponse = await axios.post('https://api.coinbase.com/oauth/token', {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      });
      
      // Store token in session
      req.session.access_token = tokenResponse.data.access_token;
      req.session.authenticated = true;
      
      // Redirect to success page
      res.redirect('/oauth-success.html');
    } catch (error) {
      console.error('OAuth token exchange error:', error);
      res.status(500).send("Failed to obtain access token");
    }
  });

  // Serve OAuth success page
  app.get("/oauth-success.html", (req: Request, res: Response) => {
    res.sendFile('oauth-success.html', { root: './public' });
  });
  
  // Get user profile from Coinbase
  app.get("/api/user-profile", async (req: Request, res: Response) => {
    if (!req.session.access_token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const profile = await coinbaseApi.getUserProfile(req.session.access_token);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });
  
  // Get wallets (accounts) from Coinbase
  app.get("/api/wallets", async (req: Request, res: Response) => {
    if (!req.session.access_token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const accounts = await coinbaseApi.getOAuthAccounts(req.session.access_token);
      res.json(accounts);
    } catch (error) {
      console.error('Error fetching wallets:', error);
      res.status(500).json({ error: "Failed to fetch wallets" });
    }
  });
  
  // Get transactions for a specific account
  app.get("/api/transactions/:account_id", async (req: Request, res: Response) => {
    if (!req.session.access_token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const accountId = req.params.account_id;
      const transactions = await coinbaseApi.getOAuthTransactions(accountId, req.session.access_token);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  
  // Get market data from unified API
  app.get("/api/unified/market-data", async (req: Request, res: Response) => {
    try {
      // Get API credentials either from session or API key vault
      const apiKey = req.session.access_token;
      
      if (apiKey) {
        // Handle OAuth flow (different API endpoint)
        // Code to get market data using OAuth token
        res.json({ method: "oauth", data: [] }); // Replace with actual implementation
      } else if (req.headers['x-api-key']) {
        // Handle API key flow
        // Code to get market data using API key
        res.json({ method: "api_key", data: [] }); // Replace with actual implementation
      } else {
        res.status(401).json({ error: "No authentication method available" });
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });
  
  // Place order using unified API
  app.post("/api/unified/place-order", async (req: Request, res: Response) => {
    try {
      // Get API credentials either from session or API key vault
      const apiKey = req.session.access_token;
      
      if (apiKey) {
        // Handle OAuth flow (different API endpoint)
        // Code to place order using OAuth token
        res.json({ method: "oauth", success: true }); // Replace with actual implementation
      } else if (req.headers['x-api-key']) {
        // Handle API key flow
        // Code to place order using API key
        res.json({ method: "api_key", success: true }); // Replace with actual implementation
      } else {
        res.status(401).json({ error: "No authentication method available" });
      }
    } catch (error) {
      console.error('Error placing order:', error);
      res.status(500).json({ error: "Failed to place order" });
    }
  });
  
  // Middleware to protect routes
  app.use('/api/protected', (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated with OAuth or API key
    if (req.session.authenticated || req.headers['x-api-key']) {
      next();
    } else {
      res.status(401).json({ error: "Authentication required" });
    }
  });
  
  // Check auth status
  app.get('/api/auth-status', (req: Request, res: Response) => {
    // Check if authenticated with OAuth
    if (req.session.authenticated && req.session.access_token) {
      return res.json({ authenticated: true, authType: 'oauth' });
    }
    
    // Check if authenticated with API key (header-based)
    if (req.headers['x-api-key']) {
      return res.json({ authenticated: true, authType: 'api_key' });
    }
    
    // Not authenticated
    res.json({ authenticated: false, authType: null });
  });
  
  // Logout endpoint
  app.post('/api/logout', (req: Request, res: Response) => {
    // Clear session data
    req.session.access_token = undefined;
    req.session.authenticated = false;
    req.session.oauth_state = undefined;
    
    res.json({ success: true });
  });
}

// Middleware to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.authenticated && !req.headers['x-api-key']) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}