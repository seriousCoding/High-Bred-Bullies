import crypto from 'crypto';
import WebSocket from 'ws';
import axios from 'axios';
import https from 'https';

// Constants
const COINBASE_EXCHANGE_API_URL = 'https://api.exchange.coinbase.com';
const COINBASE_ADVANCED_API_URL = 'https://api.coinbase.com/api/v3/brokerage';
const COINBASE_CORE_API_URL = 'https://api.coinbase.com/v2';
const COINBASE_WEBSOCKET_URL = 'wss://advanced-trade-ws.coinbase.com';

// Set up axios instances with SSL workarounds for environments with certificate issues
const exchangeApi = axios.create({
  baseURL: COINBASE_EXCHANGE_API_URL,
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

const advancedApi = axios.create({
  baseURL: COINBASE_ADVANCED_API_URL,
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

const coreApi = axios.create({
  baseURL: COINBASE_CORE_API_URL,
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * API client that handles connections to Coinbase APIs
 */
export class CoinbaseClient {
  private ws: WebSocket | null = null;
  private messageHandlers: ((data: any) => void)[] = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  
  constructor() {
    // Initialize with no credentials - they'll be set later
    this.apiKey = null;
    this.apiSecret = null;
  }
  
  /**
   * Set API credentials for authenticated requests
   */
  public setCredentials(apiKey: string, apiSecret: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    console.log(`Credentials set for API client (key: ${apiKey.substring(0, 4)}...)`);
  }
  
  /**
   * Clear API credentials
   */
  public clearCredentials(): void {
    this.apiKey = null;
    this.apiSecret = null;
    console.log('API credentials cleared');
  }
  
  /**
   * Check if the client has API credentials set
   */
  public hasCredentials(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
  
  /**
   * Connect to Coinbase WebSocket for real-time data
   */
  public connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection if any
        if (this.ws) {
          this.ws.terminate();
          this.ws = null;
        }
        
        // Clear existing intervals/timeouts
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        
        console.log('Connecting to Coinbase WebSocket...');
        this.ws = new WebSocket(COINBASE_WEBSOCKET_URL);
        
        this.ws.on('open', () => {
          console.log('WebSocket connection established');
          
          // Set up ping interval to keep the connection alive
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000); // Send ping every 30 seconds
          
          // Subscribe to heartbeat channel by default to avoid "subscribe required" errors
          try {
            // Give a small delay to ensure WebSocket is fully ready
            setTimeout(() => {
              // Store reference to WebSocket to avoid null check issues
              const ws = this.ws;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  channels: ['heartbeat'],
                  product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD']
                }));
                console.log('Subscribed to heartbeat channel');
              } else {
                console.warn('WebSocket not ready for subscription');
              }
            }, 500);
          } catch (error) {
            console.error('Failed to subscribe to heartbeat channel:', error);
          }
          
          resolve();
        });
        
        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            
            // Handle pong messages internally
            if (message.type === 'pong') {
              return;
            }
            
            // Forward message to all registered handlers
            this.messageHandlers.forEach(handler => {
              try {
                handler(message);
              } catch (err) {
                console.error('Error in WebSocket message handler:', err);
              }
            });
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });
        
        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.reconnect();
          if (!this.ws) {
            reject(error);
          }
        });
        
        this.ws.on('close', () => {
          console.log('WebSocket connection closed, attempting to reconnect...');
          this.reconnect();
        });
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        this.reconnect();
        reject(error);
      }
    });
  }
  
  /**
   * Reconnect to WebSocket with backoff
   */
  private reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connectWebSocket().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, 5000); // Wait 5 seconds before reconnecting
  }
  
  /**
   * Subscribe to WebSocket channel
   */
  public subscribe(channel: string, productIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }
      
      // Use channels array format according to Coinbase Advanced Trade API
      const subscribeMessage: any = {
        type: 'subscribe',
        product_ids: productIds,
        channels: [channel]
      };
      
      // Add authentication for authenticated channels
      if (channel === 'user' && this.apiKey && this.apiSecret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signatureMessage = timestamp + 'GET' + '/ws';
        
        const signature = crypto
          .createHmac('sha256', this.apiSecret)
          .update(signatureMessage)
          .digest('base64');
        
        subscribeMessage.api_key = this.apiKey;
        subscribeMessage.timestamp = timestamp;
        subscribeMessage.signature = signature;
      } else if (channel === 'user') {
        return reject(new Error('Authentication required for user channel'));
      }
      
      console.log(`Subscribing to channel: ${channel} for ${productIds.length} products`);
      this.ws.send(JSON.stringify(subscribeMessage));
      resolve();
    });
  }
  
  /**
   * Register a handler for WebSocket messages
   */
  public onMessage(handler: (data: any) => void): () => void {
    this.messageHandlers.push(handler);
    
    // Return a function to unregister the handler
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index !== -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }
  
  /**
   * Generate authentication headers for Advanced Trade API
   * 
   * According to Coinbase docs: https://docs.cloud.coinbase.com/advanced-trade/docs/auth
   */
  private createAdvancedHeaders(
    method: string,
    requestPath: string,
    body: string = '',
    timestamp?: string
  ): Record<string, string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials not set');
    }
    
    try {
      // Use provided timestamp or generate a new one in ISO format
      const ts = timestamp || Math.floor(Date.now() / 1000).toString();
      console.log(`Using timestamp: ${ts} for Advanced API auth`);
      
      // Ensure path is correctly formatted for Advanced API
      // The path should start with /api/v3/brokerage/
      let fullPath = requestPath;
      if (!fullPath.startsWith('/api/v3/brokerage')) {
        // Remove any leading slashes to avoid double slashes
        const trimmedPath = requestPath.replace(/^\/+/, '');
        fullPath = `/api/v3/brokerage/${trimmedPath}`;
        console.log(`Path normalized from ${requestPath} to ${fullPath}`);
      }
      
      // Extract query parameters if they exist
      let queryParams = '';
      if (fullPath.includes('?')) {
        const parts = fullPath.split('?');
        fullPath = parts[0];
        queryParams = `?${parts[1]}`;
        console.log(`Extracted query params: ${queryParams}`);
      }
      
      // Log the full path for debugging
      console.log(`Creating Advanced API signature for: ${method} ${fullPath}${queryParams}`);
      
      // Create the message to sign: timestamp + HTTP method + request path + body
      const signatureMessage = ts + method + fullPath + queryParams + body;
      console.log(`Signature message (before HMAC): ${signatureMessage}`);
      
      // Create the signature - must use base64 encoding for Coinbase
      const key = Buffer.from(this.apiSecret, 'base64');
      console.log(`Secret key loaded, length: ${key.length} bytes`);
      
      const signature = crypto
        .createHmac('sha256', key)
        .update(signatureMessage)
        .digest('base64');
      
      console.log(`Generated signature: ${signature.substring(0, 10)}...`);
      
      // Return the headers required by Advanced Trade API
      const headers = {
        'Content-Type': 'application/json',
        'CB-ACCESS-KEY': this.apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': ts
      };
      
      console.log('Advanced API headers created successfully');
      return headers;
    } catch (error) {
      console.error('Error creating signature:', error);
      throw new Error(`Failed to create signature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Make a request to the Coinbase Exchange API (public)
   */
  public async exchangeRequest<T>(
    method: string,
    path: string,
    params: Record<string, any> = {},
    data: any = null
  ): Promise<T> {
    try {
      const response = await exchangeApi.request({
        method,
        url: path,
        params,
        data
      });
      
      return response.data as T;
    } catch (error: any) {
      console.error(`Exchange API request failed: ${method} ${path}`, error.response?.data || error.message);
      throw new Error(`Coinbase Exchange API error: ${error.response?.data?.message || error.message}`);
    }
  }
  
  /**
   * Make an authenticated request to the Coinbase Advanced Trade API
   */
  public async advancedRequest<T>(
    method: string,
    path: string,
    params: Record<string, any> = {},
    data: any = null
  ): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API credentials required for Advanced Trade API');
    }
    
    console.log(`Making Advanced API request to ${method} ${path} with API key: ${this.apiKey.substring(0, 4)}...`);
    
    try {
      // Print the first few characters of the API secret to verify it's not empty
      const apiSecretPreview = this.apiSecret.substring(0, 3) + '...';
      console.log(`Using API key ${this.apiKey.substring(0, 4)}... with secret starting with ${apiSecretPreview}`);
      
      // Prepare the path with query parameters if any
      let fullPath = path;
      if (Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
        fullPath = `${path}?${searchParams.toString()}`;
        console.log(`Path with params: ${fullPath}`);
      }
      
      // Create request headers with authentication
      const dataString = data ? JSON.stringify(data) : '';
      console.log(`Request body length: ${dataString.length} characters`);
      
      // Generate headers with detailed logging
      const headers = this.createAdvancedHeaders(
        method,
        fullPath,
        dataString
      );
      
      // Verify all required headers are present
      console.log(`Request headers: CB-ACCESS-KEY=${headers['CB-ACCESS-KEY'].substring(0, 4)}..., ` +
                 `CB-ACCESS-TIMESTAMP=${headers['CB-ACCESS-TIMESTAMP']}, ` +
                 `CB-ACCESS-SIGN=${headers['CB-ACCESS-SIGN'].substring(0, 10)}...`);
      
      // Make sure to use the same URL path that was used for the signature
      console.log(`Sending Advanced API request to: ${advancedApi.defaults.baseURL}${path}`);
      const response = await advancedApi.request({
        method,
        url: path, // Use the base path for the URL
        params,    // Let axios add the params
        data,
        headers
      });
      
      console.log(`Advanced API request successful: ${method} ${path}`);
      return response.data as T;
    } catch (error: any) {
      // Capture more details about the error for debugging
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      const errorHeaders = error.response?.headers;
      
      console.error(`Advanced API request failed: ${method} ${path}`, {
        status: errorStatus,
        data: errorData,
        message: error.message,
        headers: errorHeaders
      });
      
      // Enhanced error message with more context
      let errorMessage = `Coinbase Advanced API error: ${error.message}`;
      if (errorData) {
        errorMessage += ` - ${JSON.stringify(errorData)}`;
      }
      if (errorStatus) {
        errorMessage += ` (HTTP ${errorStatus})`;
      }
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Make a request to the Coinbase Core API (v2)
   * This uses the simpler Coinbase Core API which has fewer permission requirements
   */
  public async coreRequest<T>(
    method: string,
    path: string,
    params: Record<string, any> = {},
    data: any = null,
    accessToken?: string
  ): Promise<T> {
    try {
      const headers: Record<string, string> = {};
      
      // Add authorization header if access token is provided (OAuth)
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        console.log(`Using OAuth token for Core API request: ${method} ${path}`);
      } 
      // Otherwise use API key auth if available
      else if (this.hasCredentials()) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const message = timestamp + method + path + (data ? JSON.stringify(data) : '');
        const signature = crypto
          .createHmac('sha256', this.apiSecret!)
          .update(message)
          .digest('hex');
        
        headers['CB-ACCESS-KEY'] = this.apiKey!;
        headers['CB-ACCESS-SIGN'] = signature;
        headers['CB-ACCESS-TIMESTAMP'] = timestamp;
        
        console.log(`Created Core API signature for: ${method} ${path}`);
      } else {
        console.log(`Making unauthenticated Core API request: ${method} ${path}`);
      }
      
      const response = await coreApi.request({
        method,
        url: path,
        params,
        data,
        headers
      });
      
      return response.data as T;
    } catch (error: any) {
      console.error(`Core API request failed: ${method} ${path}`, error.response?.data || error.message);
      
      // Handle common error cases with better messages
      if (error.response?.status === 401) {
        throw new Error(`Coinbase Core API authentication failed. Please check your API credentials.`);
      } else if (error.response?.status === 403) {
        throw new Error(`Coinbase Core API access denied. Your API key may not have the required permissions.`);
      } else if (error.response?.status === 429) {
        throw new Error(`Coinbase Core API rate limit exceeded. Please try again later.`);
      }
      
      throw new Error(`Coinbase Core API error: ${error.response?.data?.message || error.message}`);
    }
  }
  
  //
  // Common API methods
  //
  
  /**
   * Get list of available products (trading pairs)
   */
  public async getProducts(): Promise<any[]> {
    try {
      // If credentials are available, try the authenticated endpoint
      if (this.hasCredentials()) {
        try {
          const response = await this.advancedRequest<any>('GET', '/products');
          if (response.products && Array.isArray(response.products)) {
            console.log(`Retrieved ${response.products.length} products from Advanced API`);
            return response.products;
          }
        } catch (error) {
          console.error('Failed to get products from Advanced API, falling back to Exchange API', error);
        }
      }
      
      // Fallback to Exchange API (public)
      const products = await this.exchangeRequest<any[]>('GET', '/products');
      console.log(`Retrieved ${products.length} products from Exchange API`);
      
      // Transform exchange products to match Advanced API format
      return products.map(p => ({
        product_id: p.id,
        price: '0',
        price_percentage_change_24h: '0',
        volume_24h: p.volume || '0',
        base_increment: p.base_increment,
        quote_increment: p.quote_increment,
        quote_min_size: p.min_market_funds,
        quote_max_size: p.max_market_funds,
        base_min_size: p.base_min_size,
        base_max_size: p.base_max_size,
        base_name: p.base_currency,
        quote_name: p.quote_currency,
        status: p.status,
        cancel_only: p.cancel_only || false,
        limit_only: p.limit_only || false,
        post_only: p.post_only || false,
        trading_disabled: p.trading_disabled || false
      }));
    } catch (error) {
      console.error('Failed to get products from all APIs', error);
      throw new Error('Failed to get products from Coinbase');
    }
  }
  
  /**
   * Get product details with current price information
   */
  public async getProductDetails(productIds: string[]): Promise<any[]> {
    try {
      // Get base product data first
      const products = await this.getProducts();
      const filteredProducts = products.filter(p => productIds.includes(p.product_id));
      
      // For each product, get the current ticker/stats data
      const productsWithPrices = await Promise.all(
        filteredProducts.map(async product => {
          try {
            const stats = await this.exchangeRequest<any>(
              'GET',
              `/products/${product.product_id}/stats`
            );
            
            // Add real price data to the product
            return {
              ...product,
              price: stats.last || '0',
              price_percentage_change_24h: stats.open !== '0' && stats.last
                ? ((parseFloat(stats.last) - parseFloat(stats.open)) / parseFloat(stats.open) * 100).toFixed(2)
                : '0',
              volume_24h: stats.volume || '0'
            };
          } catch (error) {
            console.error(`Error getting stats for ${product.product_id}`, error);
            return product;
          }
        })
      );
      
      return productsWithPrices;
    } catch (error) {
      console.error('Failed to get product details', error);
      throw new Error('Failed to get product details from Coinbase');
    }
  }
  
  /**
   * Get trades for a specific product
   */
  public async getProductTrades(productId: string, limit: number = 100): Promise<any[]> {
    try {
      const trades = await this.exchangeRequest<any[]>(
        'GET',
        `/products/${productId}/trades`,
        { limit }
      );
      
      return trades;
    } catch (error) {
      console.error(`Failed to get trades for ${productId}`, error);
      throw new Error(`Failed to get trades for ${productId}`);
    }
  }
  
  /**
   * Get order book for a specific product
   */
  public async getProductOrderBook(productId: string, level: number = 2): Promise<any> {
    try {
      const orderBook = await this.exchangeRequest<any>(
        'GET',
        `/products/${productId}/book`,
        { level }
      );
      
      return orderBook;
    } catch (error) {
      console.error(`Failed to get order book for ${productId}`, error);
      throw new Error(`Failed to get order book for ${productId}`);
    }
  }
  
  /**
   * Get historical candle data for a product
   */
  public async getProductCandles(
    productId: string,
    start: string,
    end: string,
    granularity: number = 3600
  ): Promise<any[]> {
    try {
      const candles = await this.exchangeRequest<any[]>(
        'GET',
        `/products/${productId}/candles`,
        { start, end, granularity }
      );
      
      // Transform the raw candle data to a more usable format
      return candles.map(candle => ({
        time: candle[0], // timestamp
        low: candle[1],
        high: candle[2],
        open: candle[3],
        close: candle[4],
        volume: candle[5]
      }));
    } catch (error) {
      console.error(`Failed to get candles for ${productId}`, error);
      throw new Error(`Failed to get candles for ${productId}`);
    }
  }
  
  /**
   * Get user accounts (requires authentication)
   */
  public async getAccounts(): Promise<any[]> {
    if (!this.hasCredentials()) {
      throw new Error('API credentials required to get accounts');
    }
    
    try {
      const response = await this.advancedRequest<any>('GET', '/accounts');
      
      if (response.accounts && Array.isArray(response.accounts)) {
        return response.accounts;
      }
      
      throw new Error('Invalid response format from Coinbase API');
    } catch (error) {
      console.error('Failed to get accounts', error);
      throw new Error('Failed to get accounts from Coinbase');
    }
  }
  
  /**
   * Create a new order (requires authentication)
   */
  public async createOrder(orderData: any): Promise<any> {
    if (!this.hasCredentials()) {
      throw new Error('API credentials required to create order');
    }
    
    try {
      const response = await this.advancedRequest<any>(
        'POST',
        '/orders',
        {},
        orderData
      );
      
      if (response.order) {
        return response.order;
      }
      
      throw new Error('Invalid response format from Coinbase API');
    } catch (error) {
      console.error('Failed to create order', error);
      throw new Error('Failed to create order on Coinbase');
    }
  }
  
  /**
   * Get current orders (requires authentication)
   */
  public async getOrders(limit: number = 100): Promise<any[]> {
    if (!this.hasCredentials()) {
      throw new Error('API credentials required to get orders');
    }
    
    try {
      const response = await this.advancedRequest<any>(
        'GET',
        '/orders',
        { limit }
      );
      
      if (response.orders && Array.isArray(response.orders)) {
        return response.orders;
      }
      
      throw new Error('Invalid response format from Coinbase API');
    } catch (error) {
      console.error('Failed to get orders', error);
      throw new Error('Failed to get orders from Coinbase');
    }
  }
  
  /**
   * Cancel an order (requires authentication)
   */
  public async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.hasCredentials()) {
      throw new Error('API credentials required to cancel order');
    }
    
    try {
      await this.advancedRequest<any>(
        'DELETE',
        `/orders/${orderId}`
      );
      
      return true;
    } catch (error) {
      console.error(`Failed to cancel order ${orderId}`, error);
      throw new Error(`Failed to cancel order ${orderId}`);
    }
  }
  
  /**
   * Get OAuth user profile (requires OAuth access token)
   */
  public async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await this.coreRequest<any>(
        'GET',
        '/user',
        {},
        null,
        accessToken
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to get user profile', error);
      throw new Error('Failed to get user profile from Coinbase');
    }
  }
  
  /**
   * Get OAuth accounts (requires OAuth access token)
   */
  public async getOAuthAccounts(accessToken: string): Promise<any[]> {
    try {
      const response = await this.coreRequest<any>(
        'GET',
        '/accounts',
        {},
        null,
        accessToken
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to get OAuth accounts', error);
      throw new Error('Failed to get accounts from Coinbase OAuth');
    }
  }
}

// Export a singleton instance
export const coinbaseClient = new CoinbaseClient();