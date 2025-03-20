import crypto from 'crypto';
import { 
  Product, ProductBook, Candle, 
  Account, CreateOrderRequest, Order,
  Trade, WebSocketMessage, CoinbaseExchangeProduct,
  OrderSide, OrderTimeInForce
} from '@shared/coinbase-api-types';
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
    this.setupWebSocket();
  }
  
  // Reset the key rotation state
  public resetKeyRotation() {
    this.lastFailedKey = null;
    this.usedKeyIds.clear();
  }
  
  // Initialize Coinbase client with API credentials
  private initCoinbaseClient(apiKey: string, apiSecret: string) {
    this.coinbaseClient = new CoinbaseClient({ 
      apiKey, 
      apiSecret,
      version: '2021-10-05' // Use a recent API version
    });
    console.log('Coinbase client initialized with API credentials');
    return this.coinbaseClient;
  }
  
  // Set up WebSocket connection for real-time data
  private setupWebSocket() {
    // Always initialize the WebSocket connection for public data
    console.log('Initializing WebSocket connection for public data feeds');
    
    // Create a WebSocket connection without authentication
    this.ws = new WebSocket(WEBSOCKET_URL);
    
    this.ws.on('open', () => {
      console.log('WebSocket connection established to Coinbase Advanced Trade');
      
      try {
        // Subscribe only to public channels for default products
        const level2Message = {
          type: 'subscribe',
          product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
          channel: 'level2'
        };
        
        console.log('Subscribing to default level2 (order book) channels');
        this.sendWsMessage(level2Message);
        
        // After a delay, subscribe to ticker data
        setTimeout(() => {
          const marketChannelsMessage = {
            type: 'subscribe',
            product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
            channel: 'ticker'
          };
          
          console.log('Subscribing to default ticker channels');
          this.sendWsMessage(marketChannelsMessage);
        }, 1000);
      } catch (error) {
        console.error('Error setting up public WebSocket subscriptions:', error);
      }
    });
    
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
        this.setupWebSocket();
      }, 5000);
    });
  }
  
  // Add message handler for WebSocket data
  public onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }
  
  // Send WebSocket message
  private sendWsMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket connection not open');
    }
  }
  
  // Connect to WebSocket with authentication for Coinbase Advanced Trade API using the SDK approach
  public connectWebSocket(apiKey: string, apiSecret: string) {
    // Store credentials for potential reconnection
    const storedApiKey = apiKey; 
    const storedApiSecret = apiSecret;
    
    if (this.ws) {
      console.log('Closing existing WebSocket connection');
      this.ws.close();
      this.ws = null;
    }
    
    console.log('Connecting to Coinbase Advanced Trade WebSocket API using SDK approach');
    this.ws = new WebSocket(WEBSOCKET_URL);
    
    this.ws.on('open', () => {
      console.log('WebSocket connection established to Coinbase Advanced Trade');
      
      try {
        // First, subscribe to public channels without authentication
        // This avoids rate limiting issues with too many immediate subscriptions
        
        // Subscribe to level2 data first for the order book - most essential
        const level2Message = {
          type: 'subscribe',
          product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
          channel: 'level2'
        };
        
        console.log('Subscribing to default level2 (order book) channels');
        this.sendWsMessage(level2Message);
        
        // Add a delay between subscriptions to avoid rate limiting
        setTimeout(() => {
          // After a delay, subscribe to ticker data
          const marketChannelsMessage = {
            type: 'subscribe',
            product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
            channel: 'ticker'
          };
          
          console.log('Subscribing to default ticker channels');
          this.sendWsMessage(marketChannelsMessage);
          
          // Note: We're temporarily disabling authenticated user channel subscriptions
          // as we want to focus on reliable public data channels first
          // This prevents the authentication errors in the console
          
          // The code below would be used to authenticate with the WebSocket API
          // for private data channels like 'user', but we're commenting it out for now
          /*
          setTimeout(() => {
            // Calculate the timestamp (seconds since Unix epoch)
            const timestamp = Math.floor(Date.now() / 1000).toString();
            
            // Create the message to sign per Advanced Trade API docs
            // Format: timestamp + GET + /ws
            const signatureMessage = timestamp + 'GET' + '/ws';
            
            // Create the signature using HMAC-SHA256 and base64 encoding
            const signature = crypto
              .createHmac('sha256', apiSecret)
              .update(signatureMessage)
              .digest('base64');
            
            // Authenticate with the WebSocket using channel: 'user'
            const userChannelMessage = {
              type: 'subscribe',
              channel: 'user',
              api_key: apiKey,
              timestamp: timestamp,
              signature: signature
            };
            
            console.log('Subscribing to user channel with authentication');
            this.sendWsMessage(userChannelMessage);
          }, 1000); // 1 second delay for auth request
          */
        }, 1000); // 1 second delay between public subscriptions
      } catch (error) {
        console.error('Error setting up WebSocket authentication:', error);
      }
    });
    
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
      
      // Implement reconnection logic with exponential backoff
      let reconnectDelay = 5000; // Start with 5 seconds
      
      console.log(`Attempting to reconnect WebSocket in ${reconnectDelay/1000} seconds`);
      setTimeout(() => {
        if (storedApiKey && storedApiSecret) {
          console.log('Reconnecting WebSocket with stored credentials');
          this.connectWebSocket(storedApiKey, storedApiSecret);
        } else {
          console.log('Cannot reconnect WebSocket, no stored credentials');
        }
      }, reconnectDelay);
    });
  }
  
  // Subscribe to specific WebSocket feeds
  public async subscribeToFeed(subscription: any) {
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
    method: string, 
    requestPath: string, 
    body: string | null,
    apiKey: string,
    apiSecret: string
  ) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
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
    console.log(`Signature message: ${timestamp} + ${method} + ${fullPath}${queryParams}`);
    
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
      
      // Skip keys that recently failed
      const availableKeys = keys.filter(key => {
        // Skip the last failed key if it exists
        if (this.lastFailedKey === key.id) {
          return false;
        }
        
        // Skip keys that have been used in this rotation cycle
        if (this.usedKeyIds.has(key.id)) {
          return false;
        }
        
        // Skip keys with too many recent failures
        if ((key.failCount || 0) > 5) {
          // Only try keys with high failure counts if we have nothing else
          return keys.length <= 1;
        }
        
        return true;
      });
      
      if (availableKeys.length === 0) {
        // If we've tried all keys, reset and start again
        this.resetKeyRotation();
        
        // If reset doesn't give us keys, fall back to any key
        if (keys.length > 0) {
          const fallbackKey = keys[0];
          console.log(`Using fallback key ${fallbackKey.id} after rotation cycle completed`);
          return {
            apiKey: fallbackKey.apiKey,
            apiSecret: fallbackKey.apiSecret,
            keyId: fallbackKey.id
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
  
  // Make authenticated request to Coinbase API using API keys
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    apiKey: string,
    apiSecret: string,
    body?: any
  ): Promise<T> {
    try {
      console.log(`Making ${method} request to: ${endpoint}`);
      
      // The REST_API_URL should be 'https://api.coinbase.com'
      // But endpoint paths need to include '/api/v3/brokerage' for Advanced API
      let fullEndpoint: string;
      
      if (endpoint.startsWith('/api/v3/brokerage')) {
        // Endpoint already has the full path
        fullEndpoint = endpoint;
      } else {
        // Add the prefix
        const trimmedEndpoint = endpoint.replace(/^\/+/, '');
        fullEndpoint = `/api/v3/brokerage/${trimmedEndpoint}`;
      }
      
      // Construct the full URL
      const baseUrl = 'https://api.coinbase.com'; // Use directly instead of constant to ensure correctness
      const url = `${baseUrl}${fullEndpoint}`;
      
      // Create body string and headers
      const bodyString = body ? JSON.stringify(body) : null;
      const headers = this.createAuthHeaders(method, fullEndpoint, bodyString, apiKey, apiSecret);
      
      console.log(`Full request URL: ${url}`);
      console.log(`API Key present: ${!!apiKey}, Headers set: ${Object.keys(headers).join(', ')}`);
      
      // Make the API request
      const response = await fetch(url, {
        method,
        headers,
        body: bodyString,
      });
      
      // Get response text first to help with debugging
      const responseText = await response.text();
      
      // Handle non-OK responses
      if (!response.ok) {
        console.error(`Coinbase API error ${response.status}: ${responseText}`);
        console.error(`Request endpoint: ${fullEndpoint}`);
        
        // Special handling for common errors
        if (response.status === 401) {
          console.error('Authentication failed. Check API key permissions and signature generation.');
        } else if (response.status === 400) {
          console.error('Bad request. Check request parameters and format.');
        }
        
        throw new Error(`Coinbase API error (${response.status}): ${responseText}`);
      }
      
      // Parse the response as JSON
      let jsonResponse: T;
      try {
        jsonResponse = JSON.parse(responseText) as T;
      } catch (error) {
        console.error('Failed to parse API response as JSON:', responseText);
        throw new Error('Invalid JSON response from Coinbase API');
      }
      
      // Log success for debugging
      console.log(`${method} request to ${endpoint} succeeded`);
      
      return jsonResponse;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }
  
  // Make authenticated request using OAuth access token
  private async makeOAuthRequest<T>(
    method: string,
    endpoint: string,
    accessToken: string,
    body?: any
  ): Promise<T> {
    console.log(`Making OAuth request to ${endpoint}`);
    
    const url = `${COINBASE_API_URL}${endpoint}`;
    const bodyString = body ? JSON.stringify(body) : null;
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'CB-VERSION': '2021-10-05' // Specify API version for consistent behavior
    };
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyString,
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`Coinbase OAuth API error: Status ${response.status}`);
        
        // Just log the content-type header which is most relevant
        console.error(`Response content-type:`, response.headers.get('content-type'));
        console.error(`Response body:`, responseText);
        
        // Check for token expiration
        if (response.status === 401) {
          throw new Error('OAuth token expired or invalid. Please re-authenticate.');
        }
        
        throw new Error(`Coinbase API error (${response.status}): ${responseText}`);
      }
      
      // Parse the JSON response
      let jsonResponse: T;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch (error) {
        console.error('Failed to parse JSON response:', responseText);
        throw new Error('Invalid JSON response from Coinbase API');
      }
      
      return jsonResponse;
    } catch (error) {
      console.error('OAuth request failed:', error);
      throw error;
    }
  }
  
  // Products API
  
  // Public method that doesn't require authentication to get product list - uses the Exchange API for public data
  public async getPublicProducts(): Promise<Product[]> {
    try {
      console.log('Fetching products from Coinbase Exchange API...');
      
      // Use the Exchange API for public data instead of the Advanced Trade API which requires auth
      const exchangeUrl = 'https://api.exchange.coinbase.com/products';
      console.log(`Making request to public Exchange API: ${exchangeUrl}`);
      
      const response = await fetch(exchangeUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      // Log response details for debugging
      console.log(`Exchange API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch public products (${response.status}): ${errorText}`);
        throw new Error(`Failed to fetch public products: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log(`Exchange API response body (preview): ${responseText.substring(0, 200)}...`);
      
      let exchangeProducts;
      try {
        exchangeProducts = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Exchange API response:', parseError);
        throw new Error('Invalid JSON response from Coinbase Exchange API');
      }
      
      // Check the response format - Exchange API returns an array directly
      if (!Array.isArray(exchangeProducts)) {
        console.error('Unexpected response format from Coinbase Exchange API, expected array');
        throw new Error('Invalid response format from Coinbase Exchange API');
      }
      
      console.log(`Coinbase Exchange API returned ${exchangeProducts.length} products`);
      
      // Sample for logging
      if (exchangeProducts.length > 0) {
        console.log('Sample Exchange product:', JSON.stringify(exchangeProducts[0]).substring(0, 200) + '...');
      }
      
      // Now enrich with price data from the public price API
      console.log('Fetching price data to enrich products...');
      const priceUrl = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';
      
      const priceResponse = await fetch(priceUrl);
      let priceData: any = {};
      
      if (priceResponse.ok) {
        const priceJson = await priceResponse.json();
        if (priceJson && priceJson.data && priceJson.data.rates) {
          priceData = priceJson.data.rates;
          console.log(`Fetched prices for ${Object.keys(priceData).length} currencies`);
        }
      } else {
        console.warn('Failed to fetch price data, proceeding with products without prices');
      }
      
      // Convert Exchange products to our standardized format
      const products: Product[] = exchangeProducts
        .filter((product: any) => product.status === 'online')
        .map((product: any) => {
          // Try to get price from rates if available
          const baseSymbol = product.base_currency;
          const basePrice = baseSymbol && priceData['USD'] && priceData[baseSymbol] 
            ? (1 / parseFloat(priceData[baseSymbol])).toString()
            : '0';
            
          return {
            product_id: product.id || '',
            price: basePrice,
            price_percentage_change_24h: '0', // Exchange API doesn't provide this
            volume_24h: product.volume || '0',
            volume_percentage_change_24h: '0', // Exchange API doesn't provide this
            base_increment: product.base_increment || '0.00000001',
            quote_increment: product.quote_increment || '0.01',
            quote_min_size: product.min_market_funds || '0',
            quote_max_size: product.max_market_funds || '0',
            base_min_size: product.base_min_size || '0',
            base_max_size: product.base_max_size || '0',
            base_name: product.base_currency || '',
            quote_name: product.quote_currency || '',
            status: product.status || 'online',
            cancel_only: product.cancel_only || false,
            limit_only: product.limit_only || false,
            post_only: product.post_only || false,
            trading_disabled: product.status !== 'online'
          };
        });
      
      // Filter out any products without a valid product_id
      return products.filter(p => p.product_id);
    } catch (error) {
      console.error('Error fetching public products:', error);
      console.error('Detailed error:', error instanceof Error ? error.message : String(error));
      // Don't provide any fallback data, throw the error
      throw error;
    }
  }
  
  // This method has been removed to ensure we only use authentic data from Coinbase API
  // These methods have been replaced to prevent use of fallback data
  
  private getFallbackProducts(): Product[] {
    console.error('Fallback product data has been disabled to ensure data integrity');
    throw new Error('Fallback product data is not available. Only authentic Coinbase data can be used.');
  }
  
  private enrichProductsWithFallbackPrices(exchangeProducts: any[]): Product[] {
    console.error('Fallback price data has been disabled to ensure data integrity');
    throw new Error('Fallback price data is not available. Only authentic Coinbase data can be used.');
  }
  
  public async getProducts(apiKey: string, apiSecret: string): Promise<Product[]> {
    try {
      console.log('Fetching products from Coinbase Advanced Trade API directly');
      
      // Fetch products directly from the API
      const response = await this.makeRequest<any>(
        'GET',
        '/products',
        apiKey,
        apiSecret
      );
      
      // Check if the response has the expected format
      if (!response.products || !Array.isArray(response.products)) {
        console.error('Unexpected response format from products API:', response);
        throw new Error('Invalid response format from Coinbase API');
      }
      
      console.log(`API returned ${response.products.length} products`);
      
      // Convert to our standardized format
      const products: Product[] = response.products.map((product: any) => {
        return {
          product_id: product.product_id || '',
          price: product.price || '0',
          price_percentage_change_24h: product.price_percentage_change_24h || '0',
          volume_24h: product.volume_24h || '0',
          volume_percentage_change_24h: product.volume_percentage_change_24h || '0',
          base_increment: product.base_increment || '0.00000001',
          quote_increment: product.quote_increment || '0.01',
          quote_min_size: product.quote_min_size || '0',
          quote_max_size: product.quote_max_size || '0',
          base_min_size: product.base_min_size || '0',
          base_max_size: product.base_max_size || '0',
          base_name: product.base_name || product.base_currency_id || '',
          quote_name: product.quote_name || product.quote_currency_id || '',
          status: product.status || 'online',
          cancel_only: product.cancel_only || false,
          limit_only: product.limit_only || false,
          post_only: product.post_only || false,
          trading_disabled: product.status !== 'online'
        };
      });
      
      // Filter out any products without a valid product_id
      return products.filter(p => p.product_id);
    } catch (error) {
      console.error('Error fetching products:', error);
      // No fallback data, throw the error up to the caller
      throw error;
    }
  }
  
  public async getProductBook(
    productId: string, 
    apiKey: string, 
    apiSecret: string,
    limit?: number
  ): Promise<ProductBook> {
    try {
      // Advanced API endpoint for product book
      const params = new URLSearchParams();
      
      // Advanced API uses 'limit' parameter directly
      if (limit) {
        // Ensure it's a valid integer
        const limitInt = parseInt(String(limit), 10);
        if (!isNaN(limitInt) && limitInt > 0) {
          params.append('limit', limitInt.toString());
        }
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      // Request order book data from Coinbase Advanced Trade API
      const response = await this.makeRequest<any>(
        'GET',
        `/product_book/${productId}${queryString}`,
        apiKey,
        apiSecret
      );
      
      // Check if the response has the expected format
      if (!response || (!response.bids && !response.asks)) {
        console.error('Unexpected response format from product book API:', response);
        throw new Error('Invalid product book response format');
      }
      
      // Extract bids and asks arrays
      const bids = response.bids || [];
      const asks = response.asks || [];
      
      console.log(`API returned product book with ${bids.length} bids and ${asks.length} asks`);
      
      // Convert to our standardized format
      // Advanced API format may already have [price, size] format or may have a different structure
      return {
        product_id: productId,
        bids: Array.isArray(bids[0]) ? bids.map((bid: any) => [bid[0], bid[1]]) : 
              bids.map((bid: any) => [bid.price_level || bid.price || '0', bid.size || '0']),
        asks: Array.isArray(asks[0]) ? asks.map((ask: any) => [ask[0], ask[1]]) : 
              asks.map((ask: any) => [ask.price_level || ask.price || '0', ask.size || '0']),
        time: response.time || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching product book for ${productId}:`, error);
      // Throw error instead of returning empty data, let caller handle it
      throw error;
    }
  }
  
  public async getCandles(
    productId: string,
    apiKey: string,
    apiSecret: string,
    start?: string,
    end?: string,
    granularity?: string
  ): Promise<Candle[]> {
    try {
      console.log(`Fetching candles for ${productId} with Advanced Trade SDK`);
      
      // Use the Coinbase Advanced Trade SDK
      const { CoinbaseAdvTradeCredentials, CoinbaseAdvTradeClient, ProductsService } = require('@coinbase-sample/advanced-trade-sdk-ts');
      
      // Create credentials and client
      const credentials = new CoinbaseAdvTradeCredentials(apiKey, apiSecret);
      const client = new CoinbaseAdvTradeClient(credentials);
      const productService = new ProductsService(client);
      
      // Convert granularity to the format expected by Advanced API
      // Valid values: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, TWO_HOUR, SIX_HOUR, ONE_DAY
      let granularityParam = 'ONE_HOUR'; // Default
      
      if (granularity) {
        // Convert numeric granularity to named constants
        switch(granularity) {
          case '60':
            granularityParam = 'ONE_MINUTE';
            break;
          case '300':
            granularityParam = 'FIVE_MINUTE';
            break;
          case '900':
            granularityParam = 'FIFTEEN_MINUTE';
            break;
          case '1800':
            granularityParam = 'THIRTY_MINUTE';
            break;
          case '3600':
            granularityParam = 'ONE_HOUR';
            break;
          case '7200':
            granularityParam = 'TWO_HOUR';
            break;
          case '21600':
            granularityParam = 'SIX_HOUR';
            break;
          case '86400':
            granularityParam = 'ONE_DAY';
            break;
          default:
            // If it's already a named constant, use it directly
            if (['ONE_MINUTE', 'FIVE_MINUTE', 'FIFTEEN_MINUTE', 'THIRTY_MINUTE', 
                'ONE_HOUR', 'TWO_HOUR', 'SIX_HOUR', 'ONE_DAY'].includes(granularity.toUpperCase())) {
              granularityParam = granularity.toUpperCase();
            }
        }
      }
      
      // Build request parameters
      const requestParams: any = {
        productId: productId,
        granularity: granularityParam
      };
      
      // Convert dates to ISO strings if provided
      if (start) {
        const startDate = new Date(start);
        requestParams.start = startDate.toISOString();
      }
      
      if (end) {
        const endDate = new Date(end);
        requestParams.end = endDate.toISOString();
      }
      
      console.log(`SDK request params: ${JSON.stringify(requestParams)}`);
      
      // Make the SDK request
      const response = await productService.getCandles(requestParams);
      
      console.log('SDK Candles response:', JSON.stringify(response).substring(0, 200) + '...');
      
      // Check the response format
      if (!response.candles || !Array.isArray(response.candles)) {
        console.error('Unexpected candles response format from SDK:', response);
        // Instead of returning empty data, throw an error to be consistent with our data integrity policy
        throw new Error(`Failed to get valid candle data from Coinbase for ${productId}`);
      }
      
      // Convert to our standardized Candle format
      return response.candles.map((candle: any) => ({
        start: candle.start || new Date().toISOString(),
        low: candle.low || '0',
        high: candle.high || '0',
        open: candle.open || '0',
        close: candle.close || '0',
        volume: candle.volume || '0'
      }));
    } catch (error) {
      console.error(`Error fetching candles for ${productId} with SDK:`, error);
      // Instead of returning empty data, throw the error to be consistent with our data integrity policy
      throw new Error(`Failed to fetch authentic candle data from Coinbase for ${productId}`);
    }
  }
  
  // Account API
  
  public async getAccounts(apiKey: string, apiSecret: string): Promise<Account[]> {
    try {
      console.log('Fetching accounts using both Advanced Trade API and Coinbase SDK');
      let accounts: Account[] = [];
      
      try {
        // Attempt to fetch accounts from Coinbase Advanced Trade API first
        const response = await this.makeRequest<any>(
          'GET',
          '/accounts',
          apiKey,
          apiSecret
        );
        
        // Check if the response has the expected format
        if (response.accounts && Array.isArray(response.accounts) && response.accounts.length > 0) {
          console.log(`Retrieved ${response.accounts.length} accounts from Advanced Trade API`);
          
          // Convert to our standardized Account format
          accounts = response.accounts.map((account: any) => ({
            account_id: account.uuid || '',
            name: account.name || `${account.currency} Wallet`,
            uuid: account.uuid || '',
            currency: account.currency || '',
            available_balance: {
              value: account.available_balance?.value || '0',
              currency: account.available_balance?.currency || account.currency || 'USD'
            },
            default: account.default || false,
            active: account.active || true,
            created_at: account.created_at || new Date().toISOString(),
            updated_at: account.updated_at || new Date().toISOString(),
            deleted_at: account.deleted_at || null,
            type: account.type || 'WALLET',
            ready: account.ready !== undefined ? account.ready : true,
            hold: {
              value: account.hold?.value || '0',
              currency: account.hold?.currency || account.currency || 'USD'
            }
          }));
          
          if (accounts.length > 0) {
            return accounts;
          }
        }
        
        // If Advanced Trade API returns no accounts, try the regular Coinbase API
        console.log('No accounts found with Advanced Trade API, trying Coinbase SDK');
        
        // Initialize the Coinbase client if it doesn't exist
        if (!this.coinbaseClient) {
          this.initCoinbaseClient(apiKey, apiSecret);
        }
        
        if (!this.coinbaseClient) {
          console.error('Failed to initialize Coinbase client');
          return [];
        }
        
        // Use the Coinbase SDK to fetch accounts
        return new Promise<Account[]>((resolve, reject) => {
          this.coinbaseClient?.getAccounts({}, (err: any, accountsData: any) => {
            if (err) {
              console.error('Error fetching accounts with Coinbase SDK:', err);
              reject(new Error(`Failed to fetch authentic account data from Coinbase SDK: ${err.message || 'Unknown error'}`));
              return;
            }
            
            try {
              if (!accountsData || !accountsData.data) {
                console.error('Invalid account data format from Coinbase SDK');
                reject(new Error('Invalid response format from Coinbase SDK - no account data available'));
                return;
              }
              
              console.log(`Retrieved ${accountsData.data.length} accounts from Coinbase SDK`);
              
              // Convert the Coinbase SDK account format to our standard format
              const accounts = accountsData.data.map((account: any) => ({
                account_id: account.id || '',
                name: account.name || `${account.currency} Wallet`,
                uuid: account.id || '',
                currency: account.currency || '',
                available_balance: {
                  value: account.balance?.amount || '0',
                  currency: account.balance?.currency || account.currency || 'USD'
                },
                default: account.primary || false,
                active: true,
                created_at: account.created_at || new Date().toISOString(),
                updated_at: account.updated_at || new Date().toISOString(),
                deleted_at: null,
                type: account.type || 'WALLET',
                ready: true,
                hold: {
                  value: '0', // No direct hold information in Coinbase SDK
                  currency: account.currency || 'USD'
                }
              }));
              
              resolve(accounts);
            } catch (error: any) {
              console.error('Error processing Coinbase SDK accounts:', error);
              reject(new Error(`Error processing Coinbase SDK account data: ${error.message || 'Unknown error'}`));
            }
          });
        });
      } catch (error) {
        console.error('Error fetching accounts from Advanced Trade API:', error);
        
        // Try Coinbase SDK as fallback
        if (!this.coinbaseClient) {
          this.initCoinbaseClient(apiKey, apiSecret);
        }
        
        if (!this.coinbaseClient) {
          console.error('Failed to initialize Coinbase client for fallback');
          throw new Error('Failed to initialize Coinbase client - API keys may be invalid or missing');
        }
        
        // Use the Coinbase SDK to fetch accounts
        return new Promise<Account[]>((resolve, reject) => {
          this.coinbaseClient?.getAccounts({}, (err: any, accountsData: any) => {
            if (err) {
              console.error('Error fetching accounts with Coinbase SDK (fallback):', err);
              reject(new Error(`Failed to fetch authentic account data from Coinbase SDK fallback: ${err.message || 'Unknown error'}`));
              return;
            }
            
            try {
              if (!accountsData || !accountsData.data) {
                console.error('Invalid account data format from Coinbase SDK (fallback)');
                reject(new Error('Invalid response format from Coinbase SDK fallback - no account data available'));
                return;
              }
              
              console.log(`Retrieved ${accountsData.data.length} accounts from Coinbase SDK (fallback)`);
              
              // Convert the Coinbase SDK account format to our standard format
              const accounts = accountsData.data.map((account: any) => ({
                account_id: account.id || '',
                name: account.name || `${account.currency} Wallet`,
                uuid: account.id || '',
                currency: account.currency || '',
                available_balance: {
                  value: account.balance?.amount || '0',
                  currency: account.balance?.currency || account.currency || 'USD'
                },
                default: account.primary || false,
                active: true,
                created_at: account.created_at || new Date().toISOString(),
                updated_at: account.updated_at || new Date().toISOString(),
                deleted_at: null,
                type: account.type || 'WALLET',
                ready: true,
                hold: {
                  value: '0', // No direct hold information in Coinbase SDK
                  currency: account.currency || 'USD'
                }
              }));
              
              resolve(accounts);
            } catch (error: any) {
              console.error('Error processing Coinbase SDK accounts (fallback):', error);
              reject(new Error(`Error processing Coinbase SDK fallback account data: ${error.message || 'Unknown error'}`));
            }
          });
        });
      }
    } catch (error: any) {
      console.error('Fatal error fetching accounts:', error);
      // Instead of returning empty data, throw the error to be consistent with our data integrity policy
      throw new Error(`Failed to fetch authentic account data from Coinbase: ${error.message || 'Unknown error'}`);
    }
  }
  
  // Orders API
  
  public async createOrder(
    order: CreateOrderRequest,
    apiKey: string,
    apiSecret: string
  ): Promise<Order> {
    // Transform our standard order request to Coinbase Exchange format
    // The Exchange API has a simpler order format
    const exchangeOrder: any = {
      product_id: order.product_id,
      side: order.side === 'BUY' ? 'buy' : 'sell',
      type: 'limit', // Default to limit order
    };
    
    // Handle different order types based on the configuration
    if (order.order_configuration.market_market_ioc) {
      exchangeOrder.type = 'market';
      if (order.order_configuration.market_market_ioc.base_size) {
        exchangeOrder.size = order.order_configuration.market_market_ioc.base_size;
      }
      if (order.order_configuration.market_market_ioc.quote_size) {
        exchangeOrder.funds = order.order_configuration.market_market_ioc.quote_size;
      }
    } else if (order.order_configuration.limit_limit_gtc) {
      exchangeOrder.type = 'limit';
      exchangeOrder.size = order.order_configuration.limit_limit_gtc.base_size;
      exchangeOrder.price = order.order_configuration.limit_limit_gtc.limit_price;
      exchangeOrder.post_only = order.order_configuration.limit_limit_gtc.post_only;
      exchangeOrder.time_in_force = 'GTC'; // Good Till Canceled
    } else if (order.order_configuration.limit_limit_gtd) {
      exchangeOrder.type = 'limit';
      exchangeOrder.size = order.order_configuration.limit_limit_gtd.base_size;
      exchangeOrder.price = order.order_configuration.limit_limit_gtd.limit_price;
      exchangeOrder.post_only = order.order_configuration.limit_limit_gtd.post_only;
      exchangeOrder.time_in_force = 'GTT'; // Good Till Time
      exchangeOrder.cancel_after = new Date(order.order_configuration.limit_limit_gtd.end_time).toISOString();
    }
    
    if (order.client_order_id) {
      exchangeOrder.client_oid = order.client_order_id;
    }
    
    // Create the order with Coinbase Exchange API
    const createdOrder = await this.makeRequest<any>(
      'POST',
      '/orders',
      apiKey,
      apiSecret,
      exchangeOrder
    );
    
    // Convert back to our standardized Order format
    return this.convertExchangeOrderToStandardOrder(createdOrder);
  }
  
  public async getOrders(
    apiKey: string,
    apiSecret: string,
    productId?: string,
    status?: string,
    limit?: string
  ): Promise<Order[]> {
    try {
      const params = new URLSearchParams();
      
      // Convert product_id to the correct parameter name
      if (productId) params.append('product_id', productId);
      
      // Convert limit to integer string
      if (limit) {
        const limitInt = parseInt(limit, 10);
        if (!isNaN(limitInt) && limitInt > 0) {
          params.append('limit', limitInt.toString());
        }
      }
      
      // For Advanced API, use the correct status parameter format
      // Valid values: OPEN, FILLED, CANCELLED, EXPIRED, FAILED, ALL
      if (status) {
        // Convert to uppercase to ensure consistent mapping
        const upperStatus = status.toUpperCase();
        const validStatuses = ['OPEN', 'FILLED', 'CANCELLED', 'EXPIRED', 'FAILED', 'ALL'];
        
        if (validStatuses.includes(upperStatus)) {
          params.append('order_status', upperStatus);
        }
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      // Fetch orders from Advanced API
      const response = await this.makeRequest<any>(
        'GET',
        `/orders${queryString}`,
        apiKey,
        apiSecret
      );
      
      // Check response format
      if (!response.orders || !Array.isArray(response.orders)) {
        console.error('Unexpected order response format:', response);
        throw new Error('Invalid order data format received from Coinbase API');
      }
      
      // Convert to our standardized format
      return response.orders.map((order: any) => this.convertAdvancedOrderToStandardOrder(order));
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      // Instead of returning empty data, throw the error to be consistent with our data integrity policy
      throw new Error(`Failed to fetch authentic order data from Coinbase: ${error.message || 'Unknown error'}`);
    }
  }
  
  // Helper method for Advanced API format
  private convertAdvancedOrderToStandardOrder(advancedOrder: any): Order {
    // Extract order configuration
    let orderConfiguration: any = {};
    
    if (advancedOrder.order_configuration) {
      // Copy the order configuration directly if available
      orderConfiguration = advancedOrder.order_configuration;
    } else {
      // Create basic config based on type if direct format isn't available
      const orderType = advancedOrder.order_type || 'UNKNOWN';
      
      if (orderType === 'MARKET') {
        orderConfiguration.market_market_ioc = {
          base_size: advancedOrder.base_size || advancedOrder.size || '0',
          quote_size: advancedOrder.quote_size || '0'
        };
      } else if (orderType === 'LIMIT') {
        orderConfiguration.limit_limit_gtc = {
          base_size: advancedOrder.base_size || advancedOrder.size || '0',
          limit_price: advancedOrder.limit_price || advancedOrder.price || '0',
          post_only: advancedOrder.post_only || false
        };
      }
    }
    
    // Map standard Order fields
    return {
      order_id: advancedOrder.order_id || '',
      product_id: advancedOrder.product_id || '',
      user_id: advancedOrder.user_id || '',
      client_order_id: advancedOrder.client_order_id || '',
      side: advancedOrder.side || OrderSide.BUY,
      status: advancedOrder.status || 'OPEN',
      time_in_force: advancedOrder.time_in_force || OrderTimeInForce.GOOD_UNTIL_CANCELLED,
      created_time: advancedOrder.created_time || new Date().toISOString(),
      completion_percentage: advancedOrder.completion_percentage || '0',
      filled_size: advancedOrder.filled_size || '0',
      average_filled_price: advancedOrder.average_filled_price || '0',
      fee: advancedOrder.fee || '0',
      number_of_fills: advancedOrder.number_of_fills || '0',
      filled_value: advancedOrder.filled_value || '0',
      pending_cancel: advancedOrder.pending_cancel || false,
      size_in_quote: advancedOrder.size_in_quote || false,
      total_fees: advancedOrder.total_fees || '0',
      size_inclusive_of_fees: advancedOrder.size_inclusive_of_fees || false,
      total_value_after_fees: advancedOrder.total_value_after_fees || '0',
      trigger_status: advancedOrder.trigger_status || '',
      order_type: advancedOrder.order_type || 'UNKNOWN',
      reject_reason: advancedOrder.reject_reason || '',
      settled: advancedOrder.settled || false,
      product_type: advancedOrder.product_type || 'SPOT',
      reject_message: advancedOrder.reject_message || '',
      cancel_message: advancedOrder.cancel_message || '',
      order_configuration: orderConfiguration
    };
  }
  
  public async cancelOrder(
    orderId: string,
    apiKey: string,
    apiSecret: string
  ): Promise<{ success: boolean }> {
    try {
      await this.makeRequest<any>(
        'DELETE',
        `/orders/${orderId}`,
        apiKey,
        apiSecret
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return { success: false };
    }
  }
  
  // Helper method to convert Coinbase Exchange order format to our standardized format
  private convertExchangeOrderToStandardOrder(exchangeOrder: any): Order {
    // Default order configuration based on order type
    let orderConfiguration: any = {};
    
    if (exchangeOrder.type === 'market') {
      orderConfiguration.market_market_ioc = {
        base_size: exchangeOrder.size || '0',
        quote_size: exchangeOrder.funds || '0'
      };
    } else if (exchangeOrder.type === 'limit') {
      // Check time in force for GTD vs GTC
      if (exchangeOrder.time_in_force === 'GTT') {
        orderConfiguration.limit_limit_gtd = {
          base_size: exchangeOrder.size || '0',
          limit_price: exchangeOrder.price || '0',
          post_only: exchangeOrder.post_only || false,
          end_time: exchangeOrder.cancel_after || new Date().toISOString()
        };
      } else {
        orderConfiguration.limit_limit_gtc = {
          base_size: exchangeOrder.size || '0',
          limit_price: exchangeOrder.price || '0',
          post_only: exchangeOrder.post_only || false
        };
      }
    }
    
    // Map time in force
    let timeInForce: OrderTimeInForce = OrderTimeInForce.GOOD_UNTIL_CANCELLED;
    switch (exchangeOrder.time_in_force) {
      case 'GTT':
        timeInForce = OrderTimeInForce.GOOD_UNTIL_DATE_TIME;
        break;
      case 'IOC':
        timeInForce = OrderTimeInForce.IMMEDIATE_OR_CANCEL;
        break;
      case 'FOK':
        timeInForce = OrderTimeInForce.FILL_OR_KILL;
        break;
    }
    
    // Convert to our standardized Order format
    return {
      order_id: exchangeOrder.id,
      product_id: exchangeOrder.product_id,
      user_id: exchangeOrder.user_id || '',
      client_order_id: exchangeOrder.client_oid,
      side: exchangeOrder.side.toUpperCase() === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
      status: this.mapOrderStatus(exchangeOrder.status),
      time_in_force: timeInForce,
      created_time: exchangeOrder.created_at || new Date().toISOString(),
      completion_percentage: exchangeOrder.filled_size && exchangeOrder.size ? 
        ((parseFloat(exchangeOrder.filled_size) / parseFloat(exchangeOrder.size)) * 100).toString() : '0',
      filled_size: exchangeOrder.filled_size || '0',
      average_filled_price: exchangeOrder.executed_value && exchangeOrder.filled_size && parseFloat(exchangeOrder.filled_size) > 0 ? 
        (parseFloat(exchangeOrder.executed_value) / parseFloat(exchangeOrder.filled_size)).toString() : '0',
      fee: exchangeOrder.fill_fees || '0',
      number_of_fills: '0', // Not directly available in Exchange API
      filled_value: exchangeOrder.executed_value || '0',
      pending_cancel: exchangeOrder.status === 'pending' && exchangeOrder.type === 'cancel',
      size_in_quote: false, // Not directly available
      total_fees: exchangeOrder.fill_fees || '0',
      size_inclusive_of_fees: false, // Not directly available
      total_value_after_fees: 
        exchangeOrder.executed_value && exchangeOrder.fill_fees ? 
        (parseFloat(exchangeOrder.executed_value) - parseFloat(exchangeOrder.fill_fees)).toString() : '0',
      trigger_status: '', // Not applicable for Exchange API
      order_type: exchangeOrder.type.toUpperCase(),
      reject_reason: '', // Not directly available
      settled: exchangeOrder.settled || false,
      product_type: 'SPOT',
      reject_message: '', // Not directly available
      cancel_message: '', // Not directly available
      order_configuration: orderConfiguration
    };
  }
  
  // Helper method to map Coinbase Exchange order status to our standardized status
  private mapOrderStatus(exchangeStatus: string): string {
    switch (exchangeStatus) {
      case 'open':
      case 'active':
        return 'OPEN';
      case 'pending':
        return 'PENDING';
      case 'done':
        return 'FILLED';
      case 'rejected':
        return 'FAILED';
      default:
        return 'UNKNOWN';
    }
  }
  
  // Fills API
  
  public async getFills(
    apiKey: string,
    apiSecret: string,
    orderId?: string,
    productId?: string,
    limit?: string
  ): Promise<Trade[]> {
    try {
      const params = new URLSearchParams();
      
      // Format parameters for Advanced API
      if (orderId) params.append('order_id', orderId);
      if (productId) params.append('product_id', productId);
      
      // Convert limit to integer if provided
      if (limit) {
        const limitInt = parseInt(limit, 10);
        if (!isNaN(limitInt) && limitInt > 0) {
          params.append('limit', limitInt.toString());
        }
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      // Fetch fills from Advanced API
      const response = await this.makeRequest<any>(
        'GET',
        `/fills${queryString}`,
        apiKey,
        apiSecret
      );
      
      // Check if the response has the expected format
      if (!response.fills || !Array.isArray(response.fills)) {
        console.error('Unexpected fills response format:', response);
        throw new Error('Invalid fill data format received from Coinbase API');
      }
      
      // Convert to our standardized Trade format
      return response.fills.map((fill: any) => ({
        trade_id: fill.trade_id?.toString() || '',
        product_id: fill.product_id || '',
        price: fill.price || '0',
        size: fill.size || '0',
        time: fill.trade_time || fill.created_at || new Date().toISOString(),
        side: (fill.side || '').toUpperCase() === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
        bid: fill.bid || '0',
        ask: fill.ask || '0'
      }));
    } catch (error: any) {
      console.error('Error fetching fills:', error);
      // Instead of returning empty data, throw the error to be consistent with our data integrity policy
      throw new Error(`Failed to fetch authentic fill data from Coinbase: ${error.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Get recent trades for a specific product using the Coinbase Exchange API
   * This uses the public API endpoint which doesn't require authentication
   */
  public async getProductTrades(
    productId: string,
    limit: number = 100
  ): Promise<Trade[]> {
    try {
      console.log(`Fetching trades for ${productId} with limit ${limit}`);
      
      // For trades, we use the Exchange API which has reliable public endpoints
      const exchangeApiUrl = `https://api.exchange.coinbase.com/products/${productId}/trades`;
      
      console.log(`Making request to Exchange API: ${exchangeApiUrl}`);
      
      // Make request to Coinbase Exchange API
      const response = await fetch(exchangeApiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CoinbaseTradingApp/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`API error ${response.status}: ${response.statusText}`);
        // No fallback data, throw the error to be consistent with our data integrity policy
        throw new Error(`Failed to fetch authentic trade data from Coinbase Exchange API for ${productId}`);
      }
      
      // Process the Exchange API response
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error(`Unexpected Exchange API response format: ${JSON.stringify(data).substring(0, 200)}...`);
        throw new Error(`Invalid data format received from Coinbase Exchange API for ${productId}`);
      }
      
      console.log(`Received ${data.length} trades from Exchange API`);
      
      // Map the Exchange API trade format to our standard Trade interface
      const trades: Trade[] = data.map((trade: any) => ({
        trade_id: trade.trade_id ? trade.trade_id.toString() : '',
        product_id: productId,
        price: trade.price || '0',
        size: trade.size || '0',
        time: trade.time || new Date().toISOString(),
        side: (trade.side === 'buy') ? OrderSide.BUY : OrderSide.SELL,
        bid: '',
        ask: ''
      }));
      
      // Return requested number of trades
      return trades.slice(0, limit);
    } catch (error: any) {
      console.error(`Error in getProductTrades for ${productId}:`, error);
      // Instead of returning empty data, throw the error to be consistent with our data integrity policy
      throw new Error(`Failed to fetch authentic trade data from Coinbase for ${productId}: ${error.message || 'Unknown error'}`);
    }
  }
  
  // OAuth Methods
  
  public async getUserProfile(accessToken: string): Promise<any> {
    console.log('Getting user profile with OAuth token');
    try {
      const userData = await this.makeOAuthRequest<any>('GET', '/user', accessToken);
      console.log('User profile data received successfully');
      return userData;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  public async getOAuthAccounts(accessToken: string): Promise<Account[]> {
    const response = await this.makeOAuthRequest<{data: any[]}>('GET', '/accounts', accessToken);
    
    // Convert to our standardized Account format
    return response.data.map(account => ({
      account_id: account.id,
      name: account.name || `${account.currency} Wallet`,
      uuid: account.id,
      currency: account.currency,
      available_balance: {
        value: account.balance?.amount || '0',
        currency: account.currency
      },
      default: account.primary || false,
      active: account.type !== 'vault', // Vaults are not immediately available
      created_at: account.created_at || new Date().toISOString(),
      updated_at: account.updated_at || new Date().toISOString(),
      deleted_at: null,
      type: account.type.toUpperCase() || 'WALLET',
      ready: true,
      hold: {
        value: '0', // Not directly available in OAuth API
        currency: account.currency
      }
    }));
  }
  
  public async getOAuthTransactions(accessToken: string, accountId: string): Promise<any[]> {
    const response = await this.makeOAuthRequest<{data: any[]}>('GET', `/accounts/${accountId}/transactions`, accessToken);
    return response.data;
  }
}

export const coinbaseApi = new CoinbaseApiClient();