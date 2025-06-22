import crypto from 'crypto';
import { 
  Product, ProductBook, Candle, 
  Account, CreateOrderRequest, Order,
  Trade, WebSocketMessage, CoinbaseExchangeProduct,
  OrderSide, OrderTimeInForce
} from '../shared/coinbase-api-types';
import { WebSocket } from 'ws';
import { Client as CoinbaseClient } from 'coinbase';

// Coinbase API base URLs (updated to the Advanced Trade API)
const REST_API_URL = 'https://api.coinbase.com/api/v3/brokerage';
const EXCHANGE_API_URL = 'https://api.exchange.coinbase.com';
const COINBASE_API_URL = 'https://api.coinbase.com/v2';
const WEBSOCKET_URL = 'wss://advanced-trade-ws.coinbase.com';

class CoinbaseApiClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Array<(data: any) => void> = [];
  private coinbaseClient: CoinbaseClient | null = null;
  private lastFailedKey: number | null = null;
  private usedKeyIds: Set<number> = new Set();
  
  constructor() {
    // Initialize WebSocket connection
    this.setupPublicWebSocket();
  }
  
  // Reset the key rotation state
  public resetKeyRotation(): void {
    this.lastFailedKey = null;
    this.usedKeyIds.clear();
  }
  
  // Initialize Coinbase client with API credentials
  private initCoinbaseClient(apiKey: string, apiSecret: string): CoinbaseClient {
    this.coinbaseClient = new CoinbaseClient({ 
      apiKey, 
      apiSecret,
      version: '2021-10-05' // Use a recent API version
    });
    console.log('Coinbase client initialized with API credentials');
    return this.coinbaseClient;
  }
  
  // Set up WebSocket connection for public data only (no authentication)
  private setupPublicWebSocket(): void {
    if (this.ws) {
      console.log('Closing existing WebSocket connection');
      this.ws.close();
      this.ws = null;
    }
    
    console.log('Initializing WebSocket connection for public data feeds only');
    
    // Create a WebSocket connection without authentication
    this.ws = new WebSocket(WEBSOCKET_URL);
    
    this.ws.on('open', () => {
      console.log('WebSocket connection established to Coinbase Advanced Trade');
      
      try {
        // Subscribe only to public channels for default products with rate limiting
        // Start with level2 data first for the order book - this is most essential
        const level2Message = {
          type: 'subscribe',
          product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
          channel: 'level2'
        };
        
        console.log('Subscribing to level2 (order book) data');
        this.sendWsMessage(level2Message);
        
        // Add a delay before subscribing to additional channels to avoid rate limiting
        setTimeout(() => {
          // After a delay, subscribe to tick-by-tick trades
          const matchesMessage = {
            type: 'subscribe',
            product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
            channel: 'matches'
          };
          
          console.log('Subscribing to trades (matches) channel');
          this.sendWsMessage(matchesMessage);
          
          // Add another delay before subscribing to ticker data
          setTimeout(() => {
            const tickerMessage = {
              type: 'subscribe',
              product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
              channel: 'ticker'
            };
            
            console.log('Subscribing to ticker channel');
            this.sendWsMessage(tickerMessage);
          }, 1000); // 1 second delay between subscriptions
        }, 1000); // 1 second delay between subscriptions
      } catch (error) {
        console.error('Error setting up WebSocket subscriptions:', error);
      }
    });
    
    // Set up WebSocket message/error/close handlers
    this.setupWebSocketHandlers();
  }
  
  // Set up WebSocket connection for real-time data - for backward compatibility
  private setupWebSocket(): void {
    // Call the new method instead
    this.setupPublicWebSocket();
  }
  
  // Setup the standard WebSocket message and error handlers
  private setupWebSocketHandlers(): void {
    if (!this.ws) {
      console.error('Cannot set up handlers for non-existent WebSocket');
      return;
    }
    
    this.ws.on('message', (data: Buffer) => {
      try {
        const messageStr = data.toString();
        const message = JSON.parse(messageStr);
        
        // Don't log ticker updates as they come frequently
        if (!message.channel || message.channel !== 'ticker') {
          console.log(`Received WebSocket message: ${messageStr.substring(0, 200)}...`);
        }
        
        // Handle subscription success/failure
        if (message.type === 'subscriptions') {
          console.log(`WebSocket subscriptions confirmed: ${JSON.stringify(message)}`);
        }
        
        // Handle errors
        if (message.type === 'error') {
          console.error(`WebSocket error message: ${JSON.stringify(message)}`);
        }
        
        // Notify all message handlers
        this.messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (handlerError) {
            console.error('Error in WebSocket message handler:', handlerError);
          }
        });
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    this.ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed with code ${code}: ${reason}`);
      
      // Reconnect after a delay
      setTimeout(() => {
        console.log('Reconnecting to WebSocket for public data');
        this.setupPublicWebSocket();
      }, 5000);
    });
  }
  
  // Add message handler for WebSocket data
  public onMessage(handler: (data: any) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }
  
  // Send WebSocket message
  private sendWsMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket connection not open');
    }
  }
  
  // Connect to WebSocket with authentication for Coinbase Advanced Trade API using the SDK approach
  // Connect to WebSocket with key rotation (for authenticated connections)
  public async connectWebSocketWithRotation(userId: number, retryCount = 0, maxRetries = 3): Promise<void> {
    console.log(`Connecting to WebSocket with key rotation (attempt ${retryCount + 1} of ${maxRetries + 1})`);
    
    try {
      // Get API key using the rotation system
      const keyData = await this.getApiKeysWithRotation(userId);
      
      if (!keyData) {
        console.error('No available API keys found for WebSocket authentication');
        // Continue with public connection only
        this.setupPublicWebSocket();
        return;
      }
      
      const { apiKey, apiSecret, keyId } = keyData;
      
      try {
        await this.connectAuthenticatedWebSocket(apiKey, apiSecret, keyId);
        // Mark key as successful if we get here
        await this.updateKeyStatus(keyId, true);
      } catch (error) {
        console.error(`WebSocket authentication failed with key ${keyId}:`, error);
        // Mark key as failed
        await this.updateKeyStatus(keyId, false);
        
        // Retry with different key if we have attempts left
        if (retryCount < maxRetries) {
          console.log(`Retrying WebSocket connection with different key (attempt ${retryCount + 2} of ${maxRetries + 1})`);
          await this.connectWebSocketWithRotation(userId, retryCount + 1, maxRetries);
        } else {
          console.error(`Failed to authenticate WebSocket after ${maxRetries + 1} attempts`);
          // Fall back to public connection only
          this.setupPublicWebSocket();
        }
      }
    } catch (error) {
      console.error('Error in WebSocket key rotation:', error);
      // Fall back to public connection
      this.setupPublicWebSocket();
    }
  }
  
  // Connect to WebSocket with authentication - robust error handling version
  private connectAuthenticatedWebSocket(apiKey: string, apiSecret: string, keyId: number): Promise<void> {
    if (this.ws) {
      console.log('Closing existing WebSocket connection');
      this.ws.close();
      this.ws = null;
    }
    
    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        reject(new Error('WebSocket connection timed out'));
      }, 30000); // 30 second timeout
      
      console.log('Connecting to Coinbase Advanced Trade WebSocket API with authentication');
      this.ws = new WebSocket(WEBSOCKET_URL);
      
      // Keep track of authentication state
      let authenticated = false;
      
      this.ws.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket connection error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        clearTimeout(connectionTimeout);
        if (!authenticated) {
          reject(new Error('WebSocket closed before authentication completed'));
        }
      });
      
      this.ws.on('open', () => {
        console.log('WebSocket connection established');
        
        try {
          // Set up message handler for authentication response
          const messageHandler = (data: Buffer) => {
            try {
              const message = JSON.parse(data.toString());
              
              // Check for authentication success/failure
              if (message.type === 'error' && message.message === 'authentication failure') {
                clearTimeout(connectionTimeout);
                this.ws?.removeListener('message', messageHandler);
                console.warn('WebSocket error from Coinbase:', message.message);
                reject(new Error('Authentication failed with Coinbase WebSocket API'));
                return;
              }
              
              // Check for successful subscription to user channel
              if (message.type === 'subscriptions' && 
                  message.channels && 
                  message.channels.some((c: any) => c.name === 'user')) {
                clearTimeout(connectionTimeout);
                this.ws?.removeListener('message', messageHandler);
                authenticated = true;
                console.log('Successfully authenticated with Coinbase WebSocket API');
                resolve();
                return;
              }
            } catch (parseError) {
              console.error('Error parsing WebSocket message:', parseError);
            }
          };
          
          // Add temporary authentication message handler
          this.ws.on('message', messageHandler);
          
          // First, subscribe to public channels
          // Subscribe to level2 data for the order book
          const level2Message = {
            type: 'subscribe',
            product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
            channel: 'level2'
          };
          
          console.log('Subscribing to level2 channel');
          this.sendWsMessage(level2Message);
          
          // Add a delay between subscriptions to avoid rate limiting
          setTimeout(() => {
            // Subscribe to ticker channel
            const tickerMessage = {
              type: 'subscribe',
              product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
              channel: 'ticker'
            };
            
            console.log('Subscribing to ticker channel');
            this.sendWsMessage(tickerMessage);
            
            // Add authentication after a delay
            setTimeout(() => {
              // Now attempt to authenticate with user/account data
              if (apiKey && apiSecret) {
                // Create timestamp and signature for authentication
                const timestamp = Math.floor(Date.now() / 1000).toString();
                
                // Create signature for authentication as per Coinbase docs
                const signature = crypto
                  .createHmac('sha256', apiSecret)
                  .update(timestamp + 'GET' + '/users/self/verify')
                  .digest('base64');
                
                // Send authentication message
                const authMessage = {
                  type: 'subscribe',
                  product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
                  channel: 'user',
                  api_key: apiKey,
                  timestamp,
                  signature
                };
                
                console.log('Sending authentication request to WebSocket');
                this.sendWsMessage(authMessage);
              }
            }, 1000);
          }, 1000);
          
          // Set up WebSocket handlers directly here
          this.setupWebSocketHandlers();
        } catch (error) {
          console.error('Error setting up WebSocket auth:', error);
          reject(error);
        }
      });
    });
  }
  
  // Subscribe to specific WebSocket feeds
  public async subscribeToFeed(subscription: any): Promise<{success: boolean, message?: string, error?: string}> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }
      
      this.sendWsMessage(subscription);
      return { success: true, message: 'Subscription request sent' };
    } catch (error) {
      console.error('Failed to subscribe to feed:', error);
      return { success: false, error: 'Failed to subscribe to feed' };
    }
  }

  // Create authentication headers for Advanced Trade API requests
  private createAuthHeaders(
    apiKey: string,
    apiSecret: string,
    timestamp: string,
    method: string, 
    requestPath: string, 
    body: string = ''
  ): Record<string, string> {
    // Use the timestamp provided
    
    // For Advanced API, the path must be formatted exactly as required by Coinbase:
    // The prefix must be exact: /api/v3/brokerage
    let fullPath = '';
    
    // Handle different path formats
    if (requestPath.startsWith('/api/v3/brokerage')) {
      // Path already has the correct prefix
      fullPath = requestPath;
    } else {
      // Path needs the prefix
      // Remove any leading slashes to avoid double slashes
      const trimmedPath = requestPath.replace(/^\/+/, '');
      fullPath = `/api/v3/brokerage/${trimmedPath}`;
    }
    
    // Extract query parameters if they exist
    let queryParams = '';
    if (fullPath.includes('?')) {
      const parts = fullPath.split('?');
      fullPath = parts[0];
      queryParams = `?${parts[1]}`;
    }
    
    // Create the message to sign exactly as Coinbase expects:
    // timestamp + HTTP method + request path + body (if present)
    let signatureMessage = timestamp + method + fullPath + queryParams;
    
    // Add the body to the message if present
    if (body) {
      signatureMessage += body;
    }
    
    console.log(`Creating signature for: ${method} ${fullPath}${queryParams}`);
    
    // Create the signature using HMAC-SHA256 and base64 encoding
    // Advanced Trade API requires base64 encoding for the signature
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureMessage)
      .digest('base64');
    
    // Return the headers required by Advanced Trade API
    return {
      'Content-Type': 'application/json',
      'CB-ACCESS-KEY': apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp
    };
  }
  
  // Make authenticated request with key rotation
  public async getApiKeysWithRotation(userId: number): Promise<{apiKey: string, apiSecret: string, keyId: number} | null> {
    try {
      // Import storage inside the method to avoid circular dependencies
      const { storage } = await import('./storage');
      
      // Get the active API keys, already sorted by priority and health
      const keys = await storage.getActiveApiKeys(userId);
      
      if (!keys || keys.length === 0) {
        console.error('No active API keys found for user');
        return null;
      }
      
      console.log(`Found ${keys.length} active API keys for rotation`);
      
      // Skip keys that recently failed
      const availableKeys = keys.filter(key => {
        // Skip the last failed key if it exists
        if (this.lastFailedKey === key.id) {
          console.log(`Skipping recently failed key ${key.id}`);
          return false;
        }
        
        // Skip keys that have been used in this rotation cycle
        if (this.usedKeyIds.has(key.id)) {
          console.log(`Skipping already used key ${key.id} in this rotation cycle`);
          return false;
        }
        
        return true;
      });
      
      if (availableKeys.length === 0) {
        console.log('No available keys after filtering, using any key');
        // If we've tried all keys, just use the first one again
        if (keys.length > 0) {
          const key = keys[0];
          console.log(`Using key ${key.id} despite previous failure`);
          
          return {
            apiKey: key.apiKey,
            apiSecret: key.apiSecret,
            keyId: key.id
          };
        }
        
        return null;
      }
      
      // Get the first available key
      const selectedKey = availableKeys[0];
      this.usedKeyIds.add(selectedKey.id);
      
      console.log(`Selected API key ${selectedKey.id} for request`);
      return {
        apiKey: selectedKey.apiKey,
        apiSecret: selectedKey.apiSecret, 
        keyId: selectedKey.id
      };
    } catch (error) {
      console.error('Error getting API keys for rotation:', error);
      return null;
    }
  }
  
  // Handle API key success or failure
  public async updateKeyStatus(keyId: number, success: boolean): Promise<void> {
    try {
      const { storage } = await import('./storage');
      await storage.updateApiKeyStatus(keyId, success);
      
      if (!success) {
        this.lastFailedKey = keyId;
        console.error(`Marked API key ${keyId} as failed`);
      } else {
        console.log(`Marked API key ${keyId} as successful`);
      }
    } catch (error) {
      console.error('Error updating key status:', error);
    }
  }
  
  // Get public products (no authentication required)
  public async getPublicProducts(): Promise<Product[]> {
    try {
      console.log('Fetching products from Coinbase Exchange API');
      
      // First get the exchange products for the base information
      const productsResponse = await fetch('https://api.exchange.coinbase.com/products', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!productsResponse.ok) {
        throw new Error(`Failed to fetch products: ${productsResponse.status}`);
      }
      
      const exchangeProducts = await productsResponse.json() as CoinbaseExchangeProduct[];
      
      // Get current 24h stats for each product to get real price data
      const productIds = exchangeProducts.filter(p => 
        // Only include USD pairs to limit the number of API calls and focus on main products
        p.quote_currency === 'USD' && 
        // Filter out disabled products
        !p.trading_disabled && 
        // Filter out weird status products
        p.status === 'online'
      ).slice(0, 15).map(p => p.id); // Limit to 15 products to avoid rate limits
      
      console.log(`Getting stats for ${productIds.length} products`);
      
      // Get real ticker data for each product
      const statsPromises = productIds.map(async (productId) => {
        try {
          const statsResponse = await fetch(`https://api.exchange.coinbase.com/products/${productId}/stats`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          if (!statsResponse.ok) {
            console.error(`Failed to fetch stats for ${productId}: ${statsResponse.status}`);
            return null;
          }
          
          const stats = await statsResponse.json();
          return { productId, stats };
        } catch (e) {
          console.error(`Error fetching stats for ${productId}:`, e);
          return null;
        }
      });
      
      const statsResults = await Promise.all(statsPromises);
      const statsMap = new Map();
      
      statsResults.filter(Boolean).forEach(result => {
        if (result) {
          statsMap.set(result.productId, result.stats);
        }
      });
      
      // Transform exchange products to match Product interface with real data
      const products: Product[] = exchangeProducts
        .filter(p => productIds.includes(p.id))
        .map(p => {
          const stats = statsMap.get(p.id) || {};
          const price = stats.last || '0';
          const open = stats.open || '0';
          const priceChange = open !== '0' ? 
            ((parseFloat(price) - parseFloat(open)) / parseFloat(open) * 100).toFixed(2) : 
            '0';
          
          return {
            product_id: p.id,
            price: price,
            price_percentage_change_24h: priceChange,
            volume_24h: stats.volume || '0',
            volume_percentage_change_24h: '0', // Not available from the stats endpoint
            base_increment: p.base_increment,
            quote_increment: p.quote_increment,
            quote_min_size: p.min_market_funds,
            quote_max_size: p.max_market_funds,
            base_min_size: p.base_min_size,
            base_max_size: p.base_max_size,
            base_name: p.base_currency,
            quote_name: p.quote_currency,
            status: p.status,
            cancel_only: p.cancel_only,
            limit_only: p.limit_only,
            post_only: p.post_only,
            trading_disabled: p.trading_disabled
          };
        });
      
      return products;
    } catch (error) {
      console.error('Error fetching public products:', error);
      throw error;
    }
  }
  
  // Get products (authenticated version)
  public async getProducts(apiKey: string, apiSecret: string): Promise<Product[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = '/api/v3/brokerage/products';
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${REST_API_URL}/products`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.products || !Array.isArray(data.products)) {
        throw new Error('Invalid response format');
      }
      
      return data.products;
    } catch (error) {
      console.error('Error fetching products:', error);
      // Fall back to public products
      return this.getPublicProducts();
    }
  }
  
  // Get product trades
  public async getProductTrades(productId: string, apiKey: string, apiSecret: string): Promise<Trade[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = `/products/${productId}/trades`;
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${EXCHANGE_API_URL}${requestPath}`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trades: ${response.status}`);
      }
      
      const data = await response.json();
      return data as Trade[];
    } catch (error) {
      console.error(`Error fetching trades for ${productId}:`, error);
      throw error;
    }
  }
  
  // Get product order book
  public async getProductBook(productId: string, level: number = 2, apiKey: string, apiSecret: string): Promise<ProductBook> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = `/products/${productId}/book?level=${level}`;
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${EXCHANGE_API_URL}${requestPath}`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.status}`);
      }
      
      const data = await response.json();
      return data as ProductBook;
    } catch (error) {
      console.error(`Error fetching order book for ${productId}:`, error);
      throw error;
    }
  }
  
  // Get candles for a product
  public async getCandles(
    productId: string, 
    start: string, 
    end: string, 
    granularity: number = 3600,
    apiKey: string, 
    apiSecret: string
  ): Promise<Candle[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = `/products/${productId}/candles?start=${start}&end=${end}&granularity=${granularity}`;
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${EXCHANGE_API_URL}${requestPath}`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch candles: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the raw candle data to match our Candle interface
      return data.map((candle: any) => ({
        start: new Date(candle[0] * 1000).toISOString(),
        low: candle[1].toString(),
        high: candle[2].toString(),
        open: candle[3].toString(),
        close: candle[4].toString(),
        volume: candle[5].toString()
      }));
    } catch (error) {
      console.error(`Error fetching candles for ${productId}:`, error);
      throw error;
    }
  }
  
  // Get user accounts with key rotation
  public async getAccountsWithRotation(userId: number): Promise<Account[]> {
    try {
      // Get API keys with rotation
      const apiCredentials = await this.getApiKeysWithRotation(userId);
      
      if (!apiCredentials) {
        throw new Error('No valid API credentials found');
      }
      
      const { apiKey, apiSecret } = apiCredentials;
      
      return this.getAccounts(apiKey, apiSecret);
    } catch (error) {
      console.error('Error fetching accounts with rotation:', error);
      throw error;
    }
  }
  
  // Get user accounts
  public async getAccounts(apiKey: string, apiSecret: string): Promise<Account[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = '/api/v3/brokerage/accounts';
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${REST_API_URL}/accounts`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.accounts || !Array.isArray(data.accounts)) {
        throw new Error('Invalid accounts response format');
      }
      
      return data.accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }
  
  // Create a new order
  public async createOrder(order: CreateOrderRequest, apiKey: string, apiSecret: string): Promise<Order> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'POST';
      const requestPath = '/api/v3/brokerage/orders';
      const body = JSON.stringify(order);
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        body
      );
      
      const response = await fetch(`${REST_API_URL}/orders`, {
        method,
        headers,
        body
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create order: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      if (!data.order) {
        throw new Error('Invalid order response format');
      }
      
      return data.order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
  
  // Get user orders
  public async getOrders(limit: number, apiKey: string, apiSecret: string): Promise<Order[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = `/api/v3/brokerage/orders?limit=${limit}`;
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${REST_API_URL}/orders?limit=${limit}`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.orders || !Array.isArray(data.orders)) {
        throw new Error('Invalid orders response format');
      }
      
      return data.orders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }
  
  // Cancel an order
  public async cancelOrder(orderId: string, apiKey: string, apiSecret: string): Promise<{success: boolean}> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'DELETE';
      const requestPath = `/api/v3/brokerage/orders/${orderId}`;
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${REST_API_URL}/orders/${orderId}`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel order: ${response.status}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error cancelling order ${orderId}:`, error);
      throw error;
    }
  }
  
  // Get order fills
  public async getFills(orderId: string, apiKey: string, apiSecret: string): Promise<any[]> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = 'GET';
      const requestPath = `/api/v3/brokerage/orders/${orderId}/fills`;
      
      const headers = this.createAuthHeaders(
        apiKey,
        apiSecret,
        timestamp,
        method,
        requestPath,
        ''
      );
      
      const response = await fetch(`${REST_API_URL}/orders/${orderId}/fills`, {
        method,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch fills: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.fills || !Array.isArray(data.fills)) {
        throw new Error('Invalid fills response format');
      }
      
      return data.fills;
    } catch (error) {
      console.error(`Error fetching fills for order ${orderId}:`, error);
      throw error;
    }
  }
  
  // OAuth methods
  public async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${COINBASE_API_URL}/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
  
  public async getOAuthAccounts(accessToken: string): Promise<any[]> {
    try {
      const response = await fetch(`${COINBASE_API_URL}/accounts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch OAuth accounts: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching OAuth accounts:', error);
      throw error;
    }
  }
  
  public async getOAuthTransactions(accountId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await fetch(`${COINBASE_API_URL}/accounts/${accountId}/transactions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Error fetching transactions for account ${accountId}:`, error);
      throw error;
    }
  }
}

export const coinbaseApi = new CoinbaseApiClient();