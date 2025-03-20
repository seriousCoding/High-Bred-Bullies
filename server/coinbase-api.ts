import crypto from 'crypto';
import { 
  Product, ProductBook, Candle, 
  Account, CreateOrderRequest, Order,
  Trade, WebSocketMessage, CoinbaseExchangeProduct,
  OrderSide, OrderTimeInForce
} from '@shared/coinbase-api-types';
import { WebSocket } from 'ws';

// Coinbase API base URLs (updated to the Advanced Trade API)
const REST_API_URL = 'https://api.coinbase.com/api/v3/brokerage';
const COINBASE_API_URL = 'https://api.coinbase.com/v2';
const WEBSOCKET_URL = 'wss://advanced-trade-ws.coinbase.com';

class CoinbaseApiClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Array<(data: any) => void> = [];
  
  constructor() {
    // Initialize WebSocket connection
    this.setupWebSocket();
  }
  
  // Set up WebSocket connection for real-time data
  private setupWebSocket() {
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;
    
    if (apiKey && apiSecret) {
      console.log('Initializing WebSocket connection with environment API keys');
      this.connectWebSocket(apiKey, apiSecret);
    } else {
      // WebSocket will be initialized when we have API keys from the client
      console.log('WebSocket connection will be established when API keys are provided');
    }
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
  
  // Connect to WebSocket with authentication
  public connectWebSocket(apiKey: string, apiSecret: string) {
    if (this.ws) {
      this.ws.close();
    }
    
    this.ws = new WebSocket(WEBSOCKET_URL);
    
    this.ws.on('open', () => {
      console.log('WebSocket connection established');
      
      // For Coinbase Exchange WebSocket API
      const timestamp = Date.now() / 1000;
      const message = timestamp + 'GET' + '/users/self/verify';
      
      const signature = crypto
        .createHmac('sha256', Buffer.from(apiSecret, 'base64'))
        .update(message)
        .digest('base64');
      
      // Send authentication message (subscribe to heartbeat channel for connection verification)
      const authMessage = {
        type: 'subscribe',
        product_ids: ['BTC-USD'], // Add default subscription to Bitcoin
        channels: ['heartbeat', 'ticker'],
        key: apiKey,
        timestamp: timestamp.toString(),
        passphrase: '',  // Passphrase is required for some exchange accounts
        signature: signature
      };
      
      this.sendWsMessage(authMessage);
    });
    
    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        // Notify all message handlers
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (apiKey && apiSecret) {
          this.connectWebSocket(apiKey, apiSecret);
        }
      }, 5000);
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
    
    // For Advanced Trade API, the path must include /api/v3/brokerage prefix
    // Remove any leading slashes from requestPath to avoid double slashes
    const sanitizedPath = requestPath.startsWith('/') ? requestPath.substring(1) : requestPath;
    const fullPath = `/api/v3/brokerage/${sanitizedPath}`;
    
    // Create the message to sign according to Coinbase Advanced documentation
    let signatureMessage = timestamp + method + fullPath;
    
    // Add the body to the message if present
    if (body) {
      signatureMessage += body;
    }
    
    console.log(`Creating signature for: ${method} ${fullPath}`);
    
    // Create the signature using HMAC-SHA256 and hex encoding
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureMessage)
      .digest('hex');
    
    // Return the headers required by Advanced Trade API
    return {
      'Content-Type': 'application/json',
      'CB-ACCESS-KEY': apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp
    };
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
      
      // For Advanced API, ensure the endpoint doesn't already have the prefix
      const sanitizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = `${REST_API_URL}${sanitizedEndpoint}`;
      
      const bodyString = body ? JSON.stringify(body) : null;
      const headers = this.createAuthHeaders(method, endpoint, bodyString, apiKey, apiSecret);
      
      console.log(`Request URL: ${url}`);
      // Don't log the actual API key, just whether it exists
      console.log(`API Key present: ${!!apiKey}, Headers set: ${Object.keys(headers).join(', ')}`);
      
      const response = await fetch(url, {
        method,
        headers,
        body: bodyString,
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`Coinbase API error ${response.status}: ${responseText}`);
        console.error(`Request headers: `, Object.keys(headers));
        console.error(`Request endpoint: ${endpoint}`);
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
  
  public async getProducts(apiKey: string, apiSecret: string): Promise<Product[]> {
    try {
      // Fetch products from Coinbase Advanced Trade API
      const response = await this.makeRequest<any>(
        'GET',
        '/products',
        apiKey,
        apiSecret
      );
      
      // Check if the response has the expected format
      if (!response.products || !Array.isArray(response.products)) {
        console.error('Unexpected response format from products API:', response);
        return [];
      }
      
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
      
      return products;
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
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
        return {
          product_id: productId,
          bids: [],
          asks: [],
          time: new Date().toISOString()
        };
      }
      
      // Extract bids and asks arrays
      const bids = response.bids || [];
      const asks = response.asks || [];
      
      // Convert to our standardized format
      // Advanced API format may already have [price, size] format or may have a different structure
      return {
        product_id: productId,
        bids: Array.isArray(bids[0]) ? bids.map((bid: any) => [bid[0], bid[1]]) : 
              bids.map((bid: any) => [bid.price || '0', bid.size || '0']),
        asks: Array.isArray(asks[0]) ? asks.map((ask: any) => [ask[0], ask[1]]) : 
              asks.map((ask: any) => [ask.price || '0', ask.size || '0']),
        time: response.time || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching product book for ${productId}:`, error);
      // Return empty order book on error
      return {
        product_id: productId,
        bids: [],
        asks: [],
        time: new Date().toISOString()
      };
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
      // For Advanced API, use proper parameters
      const params = new URLSearchParams();
      
      // Convert dates to ISO strings if provided
      if (start) {
        const startDate = new Date(start);
        params.append('start', startDate.toISOString());
      }
      
      if (end) {
        const endDate = new Date(end);
        params.append('end', endDate.toISOString());
      }
      
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
      
      params.append('granularity', granularityParam);
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      // Advanced Trade API endpoint for candles
      const response = await this.makeRequest<any>(
        'GET',
        `/products/${productId}/candles${queryString}`,
        apiKey,
        apiSecret
      );
      
      // Check the response format
      if (!response.candles || !Array.isArray(response.candles)) {
        console.error('Unexpected candles response format:', response);
        return [];
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
      console.error(`Error fetching candles for ${productId}:`, error);
      return [];
    }
  }
  
  // Account API
  
  public async getAccounts(apiKey: string, apiSecret: string): Promise<Account[]> {
    try {
      // Fetch accounts from Coinbase Advanced Trade API
      const response = await this.makeRequest<any>(
        'GET',
        '/accounts',
        apiKey,
        apiSecret
      );
      
      // Check if the response has the expected format
      if (!response.accounts || !Array.isArray(response.accounts)) {
        console.error('Unexpected response format from accounts API:', response);
        return [];
      }
      
      // Convert to our standardized Account format
      return response.accounts.map((account: any) => ({
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
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
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
        return [];
      }
      
      // Convert to our standardized format
      return response.orders.map((order: any) => this.convertAdvancedOrderToStandardOrder(order));
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
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
        return [];
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
    } catch (error) {
      console.error('Error fetching fills:', error);
      return [];
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