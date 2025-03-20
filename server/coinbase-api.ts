import crypto from 'crypto';
import { 
  Product, ProductBook, Candle, 
  Account, CreateOrderRequest, Order,
  Trade, WebSocketMessage, CoinbaseExchangeProduct,
  OrderSide, OrderTimeInForce
} from '@shared/coinbase-api-types';
import { WebSocket } from 'ws';

// Coinbase API base URLs
const REST_API_URL = 'https://api.exchange.coinbase.com';
const COINBASE_API_URL = 'https://api.coinbase.com/v2';
const WEBSOCKET_URL = 'wss://ws-feed.exchange.coinbase.com';

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
  
  // Create authentication headers for REST API requests
  private createAuthHeaders(
    method: string, 
    requestPath: string, 
    body: string | null,
    apiKey: string,
    apiSecret: string
  ) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = timestamp + method + requestPath + (body || '');
    
    // Coinbase Exchange API requires the API secret to be base64 decoded first
    const hmacKey = Buffer.from(apiSecret, 'base64');
    const signature = crypto
      .createHmac('sha256', hmacKey)
      .update(message)
      .digest('base64');
    
    return {
      // Headers for Coinbase Exchange API
      'CB-ACCESS-KEY': apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': '', // Add your passphrase if needed
      'Content-Type': 'application/json'
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
    const url = `${REST_API_URL}${endpoint}`;
    const bodyString = body ? JSON.stringify(body) : null;
    const headers = this.createAuthHeaders(method, endpoint, bodyString, apiKey, apiSecret);
    
    const response = await fetch(url, {
      method,
      headers,
      body: bodyString,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Coinbase API error (${response.status}): ${errorText}`);
    }
    
    return response.json();
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
    // Fetch products from Coinbase Exchange API
    const exchangeProducts = await this.makeRequest<CoinbaseExchangeProduct[]>(
      'GET',
      '/products',
      apiKey,
      apiSecret
    );

    // Instead of making individual requests for each product, only fetch 
    // ticker data for a small subset of popular products to avoid rate limits
    const topProducts = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD', 'ADA-USD', 'AVAX-USD', 'MATIC-USD'];
    const tickerData = new Map<string, { price: string; volume: string }>();
    
    // Fetch ticker data only for top products
    await Promise.all(
      topProducts
        .filter(id => exchangeProducts.some(p => p.id === id)) // Only request existing products
        .map(async (productId) => {
          try {
            const ticker = await this.makeRequest<{ 
              price: string;
              volume: string;
              volume_30day: string;
            }>(
              'GET',
              `/products/${productId}/ticker`,
              apiKey,
              apiSecret
            );
            
            tickerData.set(productId, { 
              price: ticker.price || '0', 
              volume: ticker.volume || '0' 
            });
          } catch (error) {
            console.error(`Error fetching ticker for ${productId}:`, error);
            tickerData.set(productId, { price: '0', volume: '0' });
          }
        })
    );

    // Convert all products to our standardized format
    const enhancedProducts: Product[] = exchangeProducts.map((product) => {
      // Use ticker data if available, otherwise use default values
      const ticker = tickerData.get(product.id) || { price: '0', volume: '0' };
      
      return {
        product_id: product.id,
        price: ticker.price,
        price_percentage_change_24h: '0', // Not available in basic ticker
        volume_24h: ticker.volume,
        volume_percentage_change_24h: '0', // Not directly available
        base_increment: product.base_increment,
        quote_increment: product.quote_increment,
        quote_min_size: product.min_market_funds,
        quote_max_size: product.max_market_funds,
        base_min_size: product.base_min_size,
        base_max_size: product.base_max_size,
        base_name: product.base_currency,
        quote_name: product.quote_currency,
        status: product.status,
        cancel_only: product.cancel_only,
        limit_only: product.limit_only,
        post_only: product.post_only,
        trading_disabled: product.trading_disabled
      };
    });

    return enhancedProducts;
  }
  
  public async getProductBook(
    productId: string, 
    apiKey: string, 
    apiSecret: string,
    limit?: number
  ): Promise<ProductBook> {
    const level = limit && limit > 1 ? 2 : 1;
    const queryParams = `?level=${level}`;
    
    const exchangeBook = await this.makeRequest<{
      sequence: number;
      bids: [string, string, string][]; // [price, size, num-orders]
      asks: [string, string, string][]; // [price, size, num-orders]
    }>(
      'GET',
      `/products/${productId}/book${queryParams}`,
      apiKey,
      apiSecret
    );
    
    // Convert to our standardized format
    return {
      product_id: productId,
      bids: exchangeBook.bids.map(bid => [bid[0], bid[1]]),
      asks: exchangeBook.asks.map(ask => [ask[0], ask[1]]),
      time: new Date().toISOString() // Exchange API doesn't provide time in the response
    };
  }
  
  public async getCandles(
    productId: string,
    apiKey: string,
    apiSecret: string,
    start?: string,
    end?: string,
    granularity?: string
  ): Promise<Candle[]> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    if (granularity) params.append('granularity', granularity);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    // Coinbase Exchange API returns candles as an array of arrays: 
    // [ time, low, high, open, close, volume ]
    const candleData = await this.makeRequest<number[][]>(
      'GET',
      `/products/${productId}/candles${queryString}`,
      apiKey,
      apiSecret
    );
    
    // Convert to our standardized Candle format
    return candleData.map(candle => ({
      start: new Date(candle[0] * 1000).toISOString(),
      low: candle[1].toString(),
      high: candle[2].toString(),
      open: candle[3].toString(),
      close: candle[4].toString(),
      volume: candle[5].toString()
    }));
  }
  
  // Account API
  
  public async getAccounts(apiKey: string, apiSecret: string): Promise<Account[]> {
    // Coinbase Exchange API returns an array of accounts with different format
    const exchangeAccounts = await this.makeRequest<Array<{
      id: string;
      currency: string;
      balance: string;
      available: string;
      hold: string;
      profile_id: string;
      trading_enabled: boolean;
    }>>(
      'GET',
      '/accounts',
      apiKey,
      apiSecret
    );
    
    // Convert to our standardized Account format
    return exchangeAccounts.map(account => ({
      account_id: account.id,
      name: `${account.currency} Wallet`,
      uuid: account.id,
      currency: account.currency,
      available_balance: {
        value: account.available,
        currency: account.currency
      },
      default: false, // Not available in Exchange API
      active: account.trading_enabled,
      created_at: new Date().toISOString(), // Not available in Exchange API
      updated_at: new Date().toISOString(), // Not available in Exchange API
      deleted_at: null,
      type: 'WALLET',
      ready: true,
      hold: {
        value: account.hold,
        currency: account.currency
      }
    }));
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
    const params = new URLSearchParams();
    if (productId) params.append('product_id', productId);
    if (limit) params.append('limit', limit);
    
    // Coinbase Exchange API uses a different status parameter
    // "all", "open", "pending", "active", or "done"
    let statusParam = 'all';
    if (status) {
      switch (status.toUpperCase()) {
        case 'OPEN':
        case 'PENDING':
          statusParam = 'open';
          break;
        case 'FILLED':
        case 'CANCELLED':
        case 'EXPIRED':
        case 'FAILED':
          statusParam = 'done';
          break;
      }
      params.append('status', statusParam);
    }
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    // Fetch orders from Exchange API
    const exchangeOrders = await this.makeRequest<any[]>(
      'GET',
      `/orders${queryString}`,
      apiKey,
      apiSecret
    );
    
    // Convert to our standardized format
    return exchangeOrders.map(order => this.convertExchangeOrderToStandardOrder(order));
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
    const params = new URLSearchParams();
    if (orderId) params.append('order_id', orderId);
    if (productId) params.append('product_id', productId);
    if (limit) params.append('limit', limit);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    // Coinbase Exchange API returns fills in a different format
    const exchangeFills = await this.makeRequest<Array<{
      trade_id: number;
      product_id: string;
      price: string;
      size: string;
      order_id: string;
      created_at: string;
      liquidity: string;
      fee: string;
      settled: boolean;
      side: string;
    }>>(
      'GET',
      `/fills${queryString}`,
      apiKey,
      apiSecret
    );
    
    // Convert to our standardized Trade format
    return exchangeFills.map(fill => ({
      trade_id: fill.trade_id.toString(),
      product_id: fill.product_id,
      price: fill.price,
      size: fill.size,
      time: fill.created_at,
      side: fill.side.toUpperCase() === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
      bid: '0', // Not directly available in Exchange API
      ask: '0'  // Not directly available in Exchange API
    }));
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