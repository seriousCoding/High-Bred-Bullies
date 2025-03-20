import { Request, Response, Router } from 'express';
import { Session } from 'express-session';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Define session data structure
declare module 'express-session' {
  interface SessionData {
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: number;
    oauth_state?: string;
    authenticated?: boolean;
  }
}

// Environment variables required for Coinbase OAuth
const {
  COINBASE_OAUTH_CLIENT_ID,
  COINBASE_OAUTH_CLIENT_SECRET,
  COINBASE_API_KEY,
  COINBASE_API_SECRET
} = process.env;

// Check if required environment variables are set
function areOAuthEnvironmentVariablesSet() {
  return !!(COINBASE_OAUTH_CLIENT_ID && COINBASE_OAUTH_CLIENT_SECRET);
}

function areAPIEnvironmentVariablesSet() {
  return !!(COINBASE_API_KEY && COINBASE_API_SECRET);
}

// Create a router for OAuth routes
export const oauthRouter = Router();

// Constants for OAuth
const COINBASE_API_URL = "https://api.coinbase.com/v2";
const COINBASE_OAUTH_URL = "https://www.coinbase.com/oauth";
const COINBASE_TRADE_API_URL = "https://api.coinbase.com/v3/brokerage";

// Generate a secure random state for OAuth to prevent CSRF attacks
function generateSecureState() {
  return crypto.randomBytes(32).toString('hex');
}

// OAuth initialization - returns the authorization URL for the user to visit
oauthRouter.get('/init', (req: Request, res: Response) => {
  try {
    if (!areOAuthEnvironmentVariablesSet()) {
      return res.status(500).json({ 
        error: 'OAuth client configuration missing', 
        message: 'The server is not properly configured for OAuth authentication'
      });
    }

    // Generate a secure state parameter
    const state = generateSecureState();
    
    // Store the state in the session to verify on callback
    if (req.session) {
      req.session.oauth_state = state;
    }

    // Requested scopes - these determine what your app can access
    // See https://developers.coinbase.com/api/v2#scopes
    const scopes = [
      'wallet:accounts:read',
      'wallet:transactions:read',
      'wallet:user:read'
    ].join(',');

    // Base URL for the host
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    // Construct the authorization URL
    const authUrl = `${COINBASE_OAUTH_URL}/authorize` +
      `?client_id=${COINBASE_OAUTH_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state}`;
    
    // Return the URL to the client
    res.json({ 
      auth_url: authUrl,
      state: state
    });
  } catch (error) {
    console.error('Error initializing OAuth:', error);
    res.status(500).json({ 
      error: 'Failed to initialize OAuth',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// OAuth callback endpoint
oauthRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string, state?: string };
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }
    
    // Verify the state parameter to prevent CSRF attacks
    if (req.session?.oauth_state !== state) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    if (!areOAuthEnvironmentVariablesSet()) {
      return res.status(500).json({ error: 'OAuth client configuration missing' });
    }
    
    // Base URL for the host
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    // Exchange the authorization code for an access token
    const tokenResponse = await axios.post(`${COINBASE_OAUTH_URL}/token`, {
      grant_type: 'authorization_code',
      code,
      client_id: COINBASE_OAUTH_CLIENT_ID,
      client_secret: COINBASE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Store the tokens in the session
    if (req.session) {
      req.session.access_token = tokenResponse.data.access_token;
      req.session.refresh_token = tokenResponse.data.refresh_token;
      req.session.token_expires_at = Date.now() + (tokenResponse.data.expires_in * 1000);
      req.session.authenticated = true;
    }
    
    // Redirect to the success page
    res.redirect('/oauth-success.html');
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    
    // Handle error response from Coinbase
    if (axios.isAxiosError(error) && error.response) {
      console.error('Coinbase OAuth error:', error.response.data);
      return res.status(error.response.status).json({
        error: 'OAuth authentication failed',
        details: error.response.data
      });
    }
    
    res.status(500).json({
      error: 'Failed to authenticate with Coinbase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user profile using OAuth token
oauthRouter.get('/user', async (req: Request, res: Response) => {
  try {
    // Get the access token from session
    const accessToken = req.session?.access_token;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get user profile from Coinbase
    const response = await axios.get(`${COINBASE_API_URL}/user`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      // Handle token expiration or other API errors
      if (error.response.status === 401) {
        // Clear the session if token is invalid
        if (req.session) {
          req.session.access_token = undefined;
          req.session.authenticated = false;
        }
        return res.status(401).json({ error: 'Authentication token expired or invalid' });
      }
      
      return res.status(error.response.status).json({
        error: 'Coinbase API error',
        details: error.response.data
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch user profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get wallet accounts using OAuth token
oauthRouter.get('/wallets', async (req: Request, res: Response) => {
  try {
    // Get the access token from session
    const accessToken = req.session?.access_token;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get accounts from Coinbase
    const response = await axios.get(`${COINBASE_API_URL}/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching wallets:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      // Handle token expiration
      if (error.response.status === 401) {
        if (req.session) {
          req.session.access_token = undefined;
          req.session.authenticated = false;
        }
        return res.status(401).json({ error: 'Authentication token expired or invalid' });
      }
      
      return res.status(error.response.status).json({
        error: 'Coinbase API error',
        details: error.response.data
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch wallets',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get wallet transactions using OAuth token
oauthRouter.get('/transactions/:account_id', async (req: Request, res: Response) => {
  try {
    // Get the access token from session
    const accessToken = req.session?.access_token;
    const { account_id } = req.params;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get transactions from Coinbase
    const response = await axios.get(`${COINBASE_API_URL}/accounts/${account_id}/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      // Handle token expiration
      if (error.response.status === 401) {
        if (req.session) {
          req.session.access_token = undefined;
          req.session.authenticated = false;
        }
        return res.status(401).json({ error: 'Authentication token expired or invalid' });
      }
      
      return res.status(error.response.status).json({
        error: 'Coinbase API error',
        details: error.response.data
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get authenticated status
oauthRouter.get('/status', (req: Request, res: Response) => {
  const isAuthenticated = !!req.session?.authenticated;
  const hasApiCredentials = areAPIEnvironmentVariablesSet();
  
  res.json({
    authenticated: isAuthenticated,
    auth_type: isAuthenticated ? 'oauth' : null,
    has_api_credentials: hasApiCredentials
  });
});

// Logout endpoint
oauthRouter.post('/logout', (req: Request, res: Response) => {
  if (req.session) {
    // Clear out OAuth tokens
    req.session.access_token = undefined;
    req.session.refresh_token = undefined;
    req.session.token_expires_at = undefined;
    req.session.authenticated = false;
    req.session.oauth_state = undefined;
  }
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Token refresh endpoint
oauthRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.session?.refresh_token;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'No refresh token available' });
    }
    
    if (!areOAuthEnvironmentVariablesSet()) {
      return res.status(500).json({ error: 'OAuth client configuration missing' });
    }
    
    // Exchange the refresh token for a new access token
    const tokenResponse = await axios.post(`${COINBASE_OAUTH_URL}/token`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: COINBASE_OAUTH_CLIENT_ID,
      client_secret: COINBASE_OAUTH_CLIENT_SECRET
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Update the tokens in the session
    if (req.session) {
      req.session.access_token = tokenResponse.data.access_token;
      req.session.refresh_token = tokenResponse.data.refresh_token;
      req.session.token_expires_at = Date.now() + (tokenResponse.data.expires_in * 1000);
      req.session.authenticated = true;
    }
    
    res.json({
      success: true,
      expires_in: tokenResponse.data.expires_in
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      // If refresh fails, we need to re-authenticate
      if (req.session) {
        req.session.access_token = undefined;
        req.session.refresh_token = undefined;
        req.session.authenticated = false;
      }
      
      return res.status(error.response.status).json({
        error: 'Failed to refresh token',
        details: error.response.data
      });
    }
    
    res.status(500).json({
      error: 'Failed to refresh token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});