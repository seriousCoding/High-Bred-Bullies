// Coinbase API Types based on:
// https://docs.cdp.coinbase.com/advanced-trade/docs/

// Product Types for Coinbase Exchange API
export interface CoinbaseExchangeProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_min_size: string;
  base_max_size: string;
  quote_increment: string;
  base_increment: string;
  display_name: string;
  min_market_funds: string;
  max_market_funds: string;
  margin_enabled: boolean;
  post_only: boolean;
  limit_only: boolean;
  cancel_only: boolean;
  status: string;
  status_message: string;
  trading_disabled: boolean;
}

// Convert Coinbase Exchange API format to our standardized Product format
export interface Product {
  product_id: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
  volume_percentage_change_24h: string;
  base_increment: string;
  quote_increment: string;
  quote_min_size: string;
  quote_max_size: string;
  base_min_size: string;
  base_max_size: string;
  base_name: string;
  quote_name: string;
  status: string;
  cancel_only: boolean;
  limit_only: boolean;
  post_only: boolean;
  trading_disabled: boolean;
}

export interface ProductBook {
  product_id: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][]; // [price, size]
  time: string;
}

// Candle types
export interface Candle {
  start: string;
  low: string;
  high: string;
  open: string;
  close: string;
  volume: string;
}

// Account types
export interface Account {
  account_id: string;
  name: string;
  uuid: string;
  currency: string;
  available_balance: {
    value: string;
    currency: string;
  };
  default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  type: string;
  ready: boolean;
  hold: {
    value: string;
    currency: string;
  };
}

// Order types
export enum OrderSide {
  BUY = "BUY",
  SELL = "SELL"
}

export enum OrderType {
  MARKET = "MARKET",
  LIMIT = "LIMIT",
  STOP = "STOP",
  STOP_LIMIT = "STOP_LIMIT"
}

export enum OrderTimeInForce {
  GOOD_UNTIL_CANCELLED = "GOOD_UNTIL_CANCELLED",
  GOOD_UNTIL_DATE_TIME = "GOOD_UNTIL_DATE_TIME",
  IMMEDIATE_OR_CANCEL = "IMMEDIATE_OR_CANCEL",
  FILL_OR_KILL = "FILL_OR_KILL"
}

export interface CreateOrderRequest {
  client_order_id?: string;
  product_id: string;
  side: OrderSide;
  order_configuration: {
    market_market_ioc?: {
      quote_size?: string;
      base_size?: string;
    };
    limit_limit_gtc?: {
      base_size: string;
      limit_price: string;
      post_only: boolean;
    };
    limit_limit_gtd?: {
      base_size: string;
      limit_price: string;
      end_time: string;
      post_only: boolean;
    };
    stop_limit_stop_limit_gtc?: {
      base_size: string;
      limit_price: string;
      stop_price: string;
      stop_direction: "STOP_DIRECTION_STOP_UP" | "STOP_DIRECTION_STOP_DOWN";
    };
    stop_limit_stop_limit_gtd?: {
      base_size: string;
      limit_price: string;
      stop_price: string;
      end_time: string;
      stop_direction: "STOP_DIRECTION_STOP_UP" | "STOP_DIRECTION_STOP_DOWN";
    };
  };
}

export interface Order {
  order_id: string;
  product_id: string;
  user_id: string;
  client_order_id?: string;
  side: OrderSide;
  status: string;
  time_in_force: OrderTimeInForce;
  created_time: string;
  completion_percentage: string;
  filled_size: string;
  average_filled_price: string;
  fee: string;
  number_of_fills: string;
  filled_value: string;
  pending_cancel: boolean;
  size_in_quote: boolean;
  total_fees: string;
  size_inclusive_of_fees: boolean;
  total_value_after_fees: string;
  trigger_status: string;
  order_type: string;
  reject_reason: string;
  settled: boolean;
  product_type: string;
  reject_message: string;
  cancel_message: string;
  order_configuration: {
    market_market_ioc?: {
      quote_size?: string;
      base_size?: string;
    };
    limit_limit_gtc?: {
      base_size: string;
      limit_price: string;
      post_only: boolean;
    };
    limit_limit_gtd?: {
      base_size: string;
      limit_price: string;
      end_time: string;
      post_only: boolean;
    };
    stop_limit_stop_limit_gtc?: {
      base_size: string;
      limit_price: string;
      stop_price: string;
      stop_direction: "STOP_DIRECTION_STOP_UP" | "STOP_DIRECTION_STOP_DOWN";
    };
    stop_limit_stop_limit_gtd?: {
      base_size: string;
      limit_price: string;
      stop_price: string;
      end_time: string;
      stop_direction: "STOP_DIRECTION_STOP_UP" | "STOP_DIRECTION_STOP_DOWN";
    };
  };
}

// Trade types
export interface Trade {
  trade_id: string;
  product_id: string;
  price: string;
  size: string;
  time: string;
  side: OrderSide;
  bid: string;
  ask: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string;
  channel: string;
  timestamp: string;
  sequence_num: number;
}

export interface TickerMessage extends WebSocketMessage {
  events: {
    type: "ticker";
    tickers: {
      type: "ticker";
      product_id: string;
      price: string;
      volume_24h: string;
      low_24h: string;
      high_24h: string;
      low_52w: string;
      high_52w: string;
      price_percent_chg_24h: string;
    }[];
  }[];
}

export interface Level2Message extends WebSocketMessage {
  events: {
    type: "snapshot" | "update" | "l2update";
    product_id: string;
    updates?: {
      side: "buy" | "sell";
      price_level: string;
      new_quantity: string;
    }[];
    bids?: [string, string][];
    asks?: [string, string][];
  }[];
}

export interface MatchesMessage extends WebSocketMessage {
  events: {
    type: "match";
    trades: {
      trade_id: string;
      product_id: string;
      price: string;
      size: string;
      side: "buy" | "sell";
      time: string;
    }[];
  }[];
}

export interface UserMessage extends WebSocketMessage {
  events: {
    type: "snapshot" | "update";
    orders?: Order[];
    accounts?: {
      uuid: string;
      balances: {
        currency: string;
        available: string;
        hold: string;
      }[];
    }[];
  }[];
}
