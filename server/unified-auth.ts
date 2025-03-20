import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import axios from 'axios';
import { storage } from './storage';
import dotenv from 'dotenv';

// Extend the session type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    access_token?: string;
    authenticated?: boolean;
    oauth_state?: string;
  }
}

// Load environment variables
dotenv.config();

// API URLs
const COINBASE_API_URL = "https://api.coinbase.com/v2";
const COINBASE_COMMERCE_API_URL = "https://api.commerce.coinbase.com";
const COINBASE_TRADE_API_URL = "https://api.coinbase.com/v3/brokerage";

// Get environment variables
const {
  CLIENT_ID,
  CLIENT_SECRET,
  API_KEY,
  API_SECRET,
  REDIRECT_URI
} = process.env;

/**
 * Setup unified authentication routes for Coinbase
 */
export function setupUnifiedAuth(app: Express) {
  // 1. OAuth Authentication - Redirect User to Coinbase Login
  app.get("/auth/login", (req: Request, res: Response) => {
    const authUrl = `https://www.coinbase.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=wallet:accounts:read,wallet:transactions:read`;
    res.redirect(authUrl);
  });

  // 2. OAuth Callback - Exchange Code for Access Token
  app.get("/auth/callback", async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "Authorization code missing" });

    try {
      const response = await axios.post("https://www.coinbase.com/oauth/token", {
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }, { 
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded" 
        } 
      });

      // Store token in session
      if (req.session) {
        req.session.access_token = response.data.access_token;
        req.session.authenticated = true;
      }

      // Redirect to success page or frontend
      res.redirect("/oauth-success.html");
    } catch (error) {
      console.error("OAuth error:", error);
      res.status(500).json({ 
        error: "Failed to exchange authorization code", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Success page for OAuth redirection
  app.get("/oauth-success.html", (req: Request, res: Response) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f7f9fc;
          }
          .container {
            text-align: center;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            background-color: white;
          }
          h1 { color: #1652f0; }
          p { color: #5b616e; line-height: 1.5; }
          .button {
            background-color: #1652f0;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 1rem;
            text-decoration: none;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Successful!</h1>
          <p>You have successfully connected your Coinbase account.</p>
          <a href="/" class="button">Return to Dashboard</a>
        </div>
        <script>
          // Close this window if it was opened as a popup
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth_success' }, '*');
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body>
      </html>
    `;
    res.send(html);
  });

  // 3. Fetch User Profile
  app.get("/api/user-profile", async (req: Request, res: Response) => {
    // Get token from session or request
    const token = req.session?.access_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const response = await axios.get(`${COINBASE_API_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ 
        error: "Failed to fetch user profile", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // 4. Fetch Wallets & Balances
  app.get("/api/wallets", async (req: Request, res: Response) => {
    // Get token from session or request
    const token = req.session?.access_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const response = await axios.get(`${COINBASE_API_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ 
        error: "Failed to fetch wallets", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // 5. Get Recent Transactions
  app.get("/api/transactions/:account_id", async (req: Request, res: Response) => {
    const { account_id } = req.params;
    // Get token from session or request
    const token = req.session?.access_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!account_id) {
      return res.status(400).json({ error: "Account ID is required" });
    }

    try {
      const response = await axios.get(`${COINBASE_API_URL}/accounts/${account_id}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ 
        error: "Failed to fetch transactions", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // 7. Get Market Data (Coinbase Advanced Trade)
  app.get("/api/unified/market-data", async (req: Request, res: Response) => {
    try {
      // Use the env variables for API Key auth
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const path = '/api/v3/brokerage/products';
      const body = '';
      
      // Create signature
      const message = timestamp + method + path + body;
      const signature = require('crypto')
        .createHmac('sha256', API_SECRET || '')
        .update(message)
        .digest('base64');
        
      const response = await axios.get(`https://api.coinbase.com${path}`, {
        headers: {
          'CB-ACCESS-KEY': API_KEY,
          'CB-ACCESS-SIGN': signature,
          'CB-ACCESS-TIMESTAMP': timestamp
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error("Error fetching market data:", error);
      res.status(500).json({ 
        error: "Failed to fetch market data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // 8. Place a Trade Order (Coinbase Advanced Trade)
  app.post("/api/unified/place-order", async (req: Request, res: Response) => {
    try {
      const { product_id, side, size, price } = req.body;
      
      // Validate required fields
      if (!product_id || !side || !size || !price) {
        return res.status(400).json({ error: "Missing required order parameters" });
      }
      
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'POST';
      const path = '/api/v3/brokerage/orders';
      const body = JSON.stringify({
        product_id,
        side,
        order_configuration: {
          limit_limit_gtc: {
            base_size: size,
            limit_price: price,
            post_only: false
          }
        }
      });
      
      // Create signature
      const message = timestamp + method + path + body;
      const signature = require('crypto')
        .createHmac('sha256', API_SECRET || '')
        .update(message)
        .digest('base64');
        
      const response = await axios.post(`https://api.coinbase.com${path}`, body, {
        headers: {
          'CB-ACCESS-KEY': API_KEY,
          'CB-ACCESS-SIGN': signature,
          'CB-ACCESS-TIMESTAMP': timestamp,
          'Content-Type': 'application/json'
        }
      });
      
      res.json(response.data);
    } catch (error) {
      console.error("Error placing order:", error);
      res.status(500).json({ 
        error: "Failed to place order", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Middleware for API authentication check
  app.use('/api/protected', (req: Request, res: Response, next: NextFunction) => {
    // Check for OAuth token in session or header
    const token = req.session?.access_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // If we have a token, we'll consider the user authenticated
    next();
  });

  // Status endpoint to check authentication
  app.get('/api/auth-status', (req: Request, res: Response) => {
    const isAuthenticated = !!req.session?.access_token;
    
    res.json({
      authenticated: isAuthenticated,
      authType: isAuthenticated ? 'oauth' : null
    });
  });

  // Logout endpoint
  app.post('/api/logout', (req: Request, res: Response) => {
    if (req.session) {
      req.session.access_token = undefined;
      req.session.authenticated = false;
    }
    
    res.json({ success: true, message: "Logged out successfully" });
  });
}

// Middleware to require authentication for routes
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.session?.access_token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  next();
}