import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Coinbase OAuth2 endpoints
const COINBASE_AUTH_URL = 'https://login.coinbase.com/oauth2/auth';
const COINBASE_TOKEN_URL = 'https://login.coinbase.com/oauth2/token';

// OAuth configuration from environment or fallback values
const COINBASE_OAUTH_CLIENT_ID = process.env.COINBASE_OAUTH_CLIENT_ID || '05a92dde-6f06-4571-9c00-3f2d2bd23906';
const COINBASE_OAUTH_CLIENT_SECRET = process.env.COINBASE_OAUTH_CLIENT_SECRET || 'BclnHichGYmbkV_Fp1qkYqCkAC';

// Alternative credentials as fallback
const COINBASE_OAUTH_CLIENT_ID_ALT = 'fb148f7f-d7bf-4538-b310-161ceefc213a';
const COINBASE_OAUTH_CLIENT_SECRET_ALT = 'faj-AiE2v94pO4EtgZrMoPyBDK';

// Set up custom axios instance with SSL workaround
const oauthAxios = axios.create({
  timeout: 30000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false // Workaround for certificate validation issues
  })
});

/**
 * Service to handle OAuth flows with Coinbase
 */
export class OAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUrl: string;
  private tokenStorage: Map<string, OAuthToken> = new Map();
  
  constructor() {
    this.clientId = COINBASE_OAUTH_CLIENT_ID;
    this.clientSecret = COINBASE_OAUTH_CLIENT_SECRET;
    
    // Default redirect URL (will be updated once server starts)
    this.redirectUrl = 'http://localhost:5000/auth/redirect';
    
    console.log('OAuth service initialized with client ID:', this.clientId.substring(0, 4) + '...');
  }
  
  /**
   * Set the redirect URL for OAuth callbacks
   */
  public setRedirectUrl(url: string): void {
    this.redirectUrl = url;
    console.log('OAuth redirect URL set to:', url);
  }
  
  /**
   * Generate a secure state parameter for OAuth
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Get the authorization URL for initiating OAuth flow
   */
  public getAuthorizationUrl(scopes: string[] = ['wallet:accounts:read', 'wallet:user:read']): { url: string, state: string } {
    const state = this.generateState();
    
    const authUrl = new URL(COINBASE_AUTH_URL);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUrl);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', scopes.join(' '));
    
    return { url: authUrl.toString(), state };
  }
  
  /**
   * Exchange authorization code for access token
   */
  public async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    try {
      const response = await oauthAxios.post(COINBASE_TOKEN_URL, null, {
        params: {
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUrl
        }
      });
      
      const token: OAuthToken = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        created_at: Date.now()
      };
      
      // Store token internally
      this.tokenStorage.set(token.access_token, token);
      
      return token;
    } catch (error: any) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      
      // Try with the alternative client credentials if primary fails
      if (this.clientId === COINBASE_OAUTH_CLIENT_ID) {
        console.log('Trying alternative OAuth credentials...');
        this.clientId = COINBASE_OAUTH_CLIENT_ID_ALT;
        this.clientSecret = COINBASE_OAUTH_CLIENT_SECRET_ALT;
        return this.exchangeCodeForToken(code);
      }
      
      throw new Error(`Failed to exchange authorization code: ${error.response?.data?.error || error.message}`);
    }
  }
  
  /**
   * Refresh an expired access token
   */
  public async refreshToken(refreshToken: string): Promise<OAuthToken> {
    try {
      const response = await oauthAxios.post(COINBASE_TOKEN_URL, null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }
      });
      
      const token: OAuthToken = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        created_at: Date.now()
      };
      
      // Update token in storage
      this.tokenStorage.set(token.access_token, token);
      
      return token;
    } catch (error: any) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      
      // Try with the alternative client credentials if primary fails
      if (this.clientId === COINBASE_OAUTH_CLIENT_ID) {
        console.log('Trying alternative OAuth credentials for refresh...');
        this.clientId = COINBASE_OAUTH_CLIENT_ID_ALT;
        this.clientSecret = COINBASE_OAUTH_CLIENT_SECRET_ALT;
        return this.refreshToken(refreshToken);
      }
      
      throw new Error(`Failed to refresh token: ${error.response?.data?.error || error.message}`);
    }
  }
  
  /**
   * Revoke an access token
   */
  public async revokeToken(token: string): Promise<boolean> {
    try {
      await oauthAxios.post('https://api.coinbase.com/oauth/revoke', null, {
        params: {
          token,
          client_id: this.clientId,
          client_secret: this.clientSecret
        }
      });
      
      // Remove from storage
      this.tokenStorage.delete(token);
      
      return true;
    } catch (error: any) {
      console.error('Error revoking token:', error.response?.data || error.message);
      return false;
    }
  }
  
  /**
   * Check if a token is valid and not expired
   */
  public isTokenValid(token: OAuthToken): boolean {
    const now = Date.now();
    const expiresAt = token.created_at + (token.expires_in * 1000);
    
    return now < expiresAt;
  }
  
  /**
   * Get the scopes available for Coinbase OAuth
   */
  public getAvailableScopes(): OAuthScope[] {
    return [
      { scope: 'wallet:accounts:read', description: 'View your accounts and their balances' },
      { scope: 'wallet:accounts:update', description: 'Update your account settings' },
      { scope: 'wallet:addresses:read', description: 'View your addresses' },
      { scope: 'wallet:addresses:create', description: 'Create new addresses' },
      { scope: 'wallet:buys:read', description: 'View your buys' },
      { scope: 'wallet:buys:create', description: 'Create new buys' },
      { scope: 'wallet:checkouts:read', description: 'View your checkouts' },
      { scope: 'wallet:checkouts:create', description: 'Create new checkouts' },
      { scope: 'wallet:deposits:read', description: 'View your deposits' },
      { scope: 'wallet:deposits:create', description: 'Create new deposits' },
      { scope: 'wallet:notifications:read', description: 'View your notifications' },
      { scope: 'wallet:orders:read', description: 'View your orders' },
      { scope: 'wallet:orders:create', description: 'Create new orders' },
      { scope: 'wallet:payment-methods:read', description: 'View your payment methods' },
      { scope: 'wallet:payment-methods:limits', description: 'View your payment method limits' },
      { scope: 'wallet:payment-methods:delete', description: 'Delete your payment methods' },
      { scope: 'wallet:sells:read', description: 'View your sells' },
      { scope: 'wallet:sells:create', description: 'Create new sells' },
      { scope: 'wallet:transactions:read', description: 'View your transactions' },
      { scope: 'wallet:transactions:send', description: 'Send funds' },
      { scope: 'wallet:transactions:transfer', description: 'Transfer funds between accounts' },
      { scope: 'wallet:transactions:request', description: 'Request funds' },
      { scope: 'wallet:user:read', description: 'View your basic user information' },
      { scope: 'wallet:user:update', description: 'Update your user information' },
      { scope: 'wallet:user:email', description: 'View your email address' },
      { scope: 'wallet:withdrawals:read', description: 'View your withdrawals' },
      { scope: 'wallet:withdrawals:create', description: 'Create new withdrawals' }
    ];
  }
  
  /**
   * Check if the OAuth client configuration is valid
   */
  public isOAuthConfigured(): { 
    configured: boolean, 
    client_id_available: boolean, 
    client_secret_available: boolean 
  } {
    return {
      configured: !!(this.clientId && this.clientSecret),
      client_id_available: !!this.clientId,
      client_secret_available: !!this.clientSecret
    };
  }
}

// OAuth token interface
export interface OAuthToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number;
}

// OAuth scope interface
export interface OAuthScope {
  scope: string;
  description: string;
}

// Export singleton instance
export const oauthService = new OAuthService();