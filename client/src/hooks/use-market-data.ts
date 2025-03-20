import * as React from 'react';
import { useWebSocket } from './use-websocket';
import { useMarkets } from '@/context/MarketsContext';

interface OrderBookEntry {
  price: string;
  size: string;
  total: string;
  depth: number;
}

interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: {
    value: string;
    percentage: string;
  };
}

interface Trade {
  trade_id: string;
  price: string;
  size: string;
  time: string;
  side: "buy" | "sell";
}

interface TickerData {
  price: string;
  volume_24h: string;
  change_24h: string;
  low_24h: string;
  high_24h: string;
  last_update: string;
}

export function useMarketData(productId: string) {
  const { messages, subscribe, isConnected } = useWebSocket();
  const { markets } = useMarkets();
  
  const [orderBook, setOrderBook] = React.useState<OrderBook>({
    bids: [],
    asks: [],
    spread: { value: '0', percentage: '0' }
  });
  
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [ticker, setTicker] = React.useState<TickerData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Message processing tracking
  const processedMessagesRef = React.useRef<Set<number>>(new Set());
  const lastMessagesLengthRef = React.useRef<number>(0);
  
  // Helper function to process order book updates
  const processOrderBookUpdates = React.useCallback((events: any[]) => {
    setOrderBook(prevOrderBook => {
      // Create shallow copies of bid and ask arrays
      const updatedBids = [...prevOrderBook.bids];
      const updatedAsks = [...prevOrderBook.asks];
      
      // Process each update event
      events.forEach(event => {
        if (event.type === 'update' && event.updates) {
          event.updates.forEach((update: any) => {
            const price = update.price_level;
            const size = update.new_quantity;
            const side = update.side;
            
            if (side === 'bid') {
              // Update bids
              const existingIndex = updatedBids.findIndex(bid => bid.price === price);
              if (existingIndex >= 0) {
                if (size === '0') {
                  // Remove the price level
                  updatedBids.splice(existingIndex, 1);
                } else {
                  // Update the size
                  updatedBids[existingIndex].size = size;
                }
              } else if (size !== '0') {
                // Add new bid
                updatedBids.push({ price, size, total: '0', depth: 0 });
              }
            } else if (side === 'offer') {
              // Update asks
              const existingIndex = updatedAsks.findIndex(ask => ask.price === price);
              if (existingIndex >= 0) {
                if (size === '0') {
                  // Remove the price level
                  updatedAsks.splice(existingIndex, 1);
                } else {
                  // Update the size
                  updatedAsks[existingIndex].size = size;
                }
              } else if (size !== '0') {
                // Add new ask
                updatedAsks.push({ price, size, total: '0', depth: 0 });
              }
            }
          });
        } else if (event.type === 'snapshot') {
          // Replace the entire order book
          if (event.bids) {
            const bids = event.bids.map(([price, size]: [string, string]) => ({
              price,
              size,
              total: '0',
              depth: 0
            }));
            updatedBids.length = 0;
            updatedBids.push(...bids);
          }
          
          if (event.asks) {
            const asks = event.asks.map(([price, size]: [string, string]) => ({
              price,
              size,
              total: '0',
              depth: 0
            }));
            updatedAsks.length = 0;
            updatedAsks.push(...asks);
          }
        }
      });
      
      // Sort the bids (highest first) and asks (lowest first)
      updatedBids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      updatedAsks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      
      // Limit the number of entries
      const limitedBids = updatedBids.slice(0, 20);
      const limitedAsks = updatedAsks.slice(0, 20);
      
      // Calculate totals and depth percentages
      let bidTotal = 0;
      let askTotal = 0;
      
      // Calculate bid totals
      limitedBids.forEach(bid => {
        bidTotal += parseFloat(bid.size) * parseFloat(bid.price);
        bid.total = bidTotal.toFixed(2);
      });
      
      // Calculate ask totals
      limitedAsks.forEach(ask => {
        askTotal += parseFloat(ask.size) * parseFloat(ask.price);
        ask.total = askTotal.toFixed(2);
      });
      
      // Calculate max depth for visualization
      const maxTotal = Math.max(
        bidTotal,
        askTotal
      );
      
      // Update depth percentages
      limitedBids.forEach(bid => {
        bid.depth = (parseFloat(bid.total) / maxTotal) * 100;
      });
      
      limitedAsks.forEach(ask => {
        ask.depth = (parseFloat(ask.total) / maxTotal) * 100;
      });
      
      // Calculate spread
      let spread = { value: '0', percentage: '0' };
      if (limitedBids.length > 0 && limitedAsks.length > 0) {
        const bestBid = parseFloat(limitedBids[0].price);
        const bestAsk = parseFloat(limitedAsks[0].price);
        const spreadValue = bestAsk - bestBid;
        const spreadPercentage = (spreadValue / bestAsk) * 100;
        
        spread = {
          value: spreadValue.toFixed(2),
          percentage: spreadPercentage.toFixed(2)
        };
      }
      
      return {
        bids: limitedBids,
        asks: limitedAsks,
        spread
      };
    });
  }, []);
  
  // Subscribe to relevant feeds when connected with rate limiting
  React.useEffect(() => {
    if (!isConnected || !productId) return;
    
    // Start with order book updates (most important)
    console.log(`Subscribing to market data for ${productId} with rate limiting`);
    
    subscribe({
      type: 'subscribe',
      product_ids: [productId],
      channel: 'level2'
    });
    
    // Add delays between subscriptions to avoid rate limiting
    // Subscribe to ticker updates after a delay
    const tickerTimeout = setTimeout(() => {
      if (isConnected) {
        subscribe({
          type: 'subscribe',
          product_ids: [productId],
          channel: 'ticker'
        });
      }
    }, 2000);
    
    // Subscribe to matches (trades) after a longer delay
    const matchesTimeout = setTimeout(() => {
      if (isConnected) {
        subscribe({
          type: 'subscribe',
          product_ids: [productId],
          channel: 'matches'
        });
      }
    }, 4000);
    
    setIsLoading(false);
    
    // Clean up timeouts if component unmounts or productId changes
    return () => {
      clearTimeout(tickerTimeout);
      clearTimeout(matchesTimeout);
    };
  }, [isConnected, productId, subscribe]);
  
  // Process incoming WebSocket messages
  React.useEffect(() => {
    if (!messages || messages.length === 0 || !productId) return;
    
    // Only process new messages since last render
    if (messages.length === lastMessagesLengthRef.current) return;
    
    // Update the reference to the current messages length
    const startIndex = Math.max(0, lastMessagesLengthRef.current);
    lastMessagesLengthRef.current = messages.length;
    
    // Get only new messages
    const newMessages = messages.slice(startIndex);
    
    // Process each new message
    newMessages.forEach((message) => {
      if (!message.channel) return;
      
      // Process different types of messages
      switch (message.channel) {
        case 'l2_data':
          if (message.events && message.events.length > 0) {
            // Only process events for the selected product
            const relevantEvents = message.events.filter(
              (event: any) => event.product_id === productId
            );
            
            if (relevantEvents.length > 0) {
              processOrderBookUpdates(relevantEvents);
            }
          }
          break;
          
        case 'ticker':
          if (message.events && message.events.length > 0) {
            // Find ticker for the selected product
            const tickerEvent = message.events.find(
              (event: any) => event.type === 'ticker' && 
              event.tickers && 
              event.tickers.some((t: any) => t.product_id === productId)
            );
            
            if (tickerEvent) {
              const productTicker = tickerEvent.tickers.find(
                (t: any) => t.product_id === productId
              );
              
              if (productTicker) {
                setTicker({
                  price: productTicker.price,
                  volume_24h: productTicker.volume_24h,
                  change_24h: productTicker.price_percent_chg_24h,
                  low_24h: productTicker.low_24h,
                  high_24h: productTicker.high_24h,
                  last_update: message.timestamp
                });
              }
            }
          }
          break;
          
        case 'matches':
          if (message.events && message.events.length > 0) {
            // Find trades for the selected product
            const tradeEvents = message.events.filter(
              (event: any) => event.type === 'match' && 
              event.trades && 
              event.trades.some((t: any) => t.product_id === productId)
            );
            
            if (tradeEvents.length > 0) {
              const newTrades = tradeEvents.flatMap((event: any) => 
                event.trades
                  .filter((t: any) => t.product_id === productId)
                  .map((t: any) => ({
                    trade_id: t.trade_id,
                    price: t.price,
                    size: t.size,
                    time: t.time,
                    side: t.side
                  }))
              );
              
              if (newTrades.length > 0) {
                setTrades(prev => {
                  // Combine with existing trades, prevent duplicates, and limit to 50
                  const merged = [...newTrades, ...prev];
                  const unique = merged.filter((trade, index, self) => 
                    index === self.findIndex(t => t.trade_id === trade.trade_id)
                  );
                  return unique.slice(0, 50);
                });
              }
            }
          }
          break;
      }
    });
  }, [messages, productId, processOrderBookUpdates]);
  
  return {
    orderBook,
    trades,
    ticker,
    isLoading
  };
}