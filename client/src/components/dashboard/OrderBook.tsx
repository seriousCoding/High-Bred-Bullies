import { useEffect, useState } from "react";
import { useMarkets } from "@/context/MarketsContext";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useWebSocket } from "@/hooks/use-websocket";

type OrderBookEntry = {
  price: string;
  size: string;
  total: string;
  depth: number; // Percentage for visual depth bar
};

type OrderBookData = {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: {
    value: string;
    percentage: string;
  };
};

export function OrderBook() {
  const [precision, setPrecision] = useState<string>("0.1");
  const [orderBookData, setOrderBookData] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: { value: "0", percentage: "0" },
  });
  
  const { selectedMarket } = useMarkets();
  const { apiKey, apiSecret } = useApiKeys();
  const { subscribe, messages, status } = useWebSocket();
  
  // Initial fetch of order book data
  useEffect(() => {
    if (!selectedMarket || !apiKey || !apiSecret) return;
    
    const fetchOrderBook = async () => {
      try {
        const response = await fetch(`/api/products/${selectedMarket.product_id}/book`, {
          headers: {
            'x-api-key': apiKey,
            'x-api-secret': apiSecret
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching order book: ${response.statusText}`);
        }
        
        const data = await response.json();
        processOrderBookData(data);
      } catch (error) {
        console.error("Failed to fetch order book:", error);
      }
    };
    
    fetchOrderBook();
    
    // Subscribe to level2 updates via WebSocket
    subscribe({
      type: "subscribe",
      product_ids: [selectedMarket.product_id],
      channel: "level2"
    });
    
    return () => {
      // Unsubscribe when unmounting or changing market
      subscribe({
        type: "unsubscribe",
        product_ids: [selectedMarket.product_id],
        channel: "level2"
      });
    };
  }, [selectedMarket, apiKey, apiSecret, precision]);
  
  // Process WebSocket messages
  useEffect(() => {
    if (!messages.length) return;
    
    // Process only the latest level2 message
    const level2Messages = messages.filter(msg => 
      msg.channel === "level2" && 
      msg.events && 
      msg.events.length > 0
    );
    
    if (level2Messages.length > 0) {
      const latestMessage = level2Messages[level2Messages.length - 1];
      
      // Check if it's a snapshot or update
      if (latestMessage.events[0].type === "snapshot") {
        processOrderBookData({
          product_id: selectedMarket!.product_id,
          asks: latestMessage.events[0].asks,
          bids: latestMessage.events[0].bids,
          time: latestMessage.timestamp
        });
      } else if (latestMessage.events[0].type === "l2update") {
        updateOrderBook(latestMessage.events[0].updates);
      }
    }
  }, [messages]);
  
  // Process initial order book data
  const processOrderBookData = (data: any) => {
    if (!data || !data.bids || !data.asks) return;
    
    // Apply precision filter (this is simplified, real implementations would be more complex)
    const precisionValue = parseFloat(precision);
    
    // Extract and process bids (buy orders)
    const bids = data.bids
      .map((bid: [string, string]) => ({
        price: bid[0],
        size: bid[1],
        total: (parseFloat(bid[0]) * parseFloat(bid[1])).toFixed(2)
      }))
      .slice(0, 10); // Limit to top 10 bids
    
    // Extract and process asks (sell orders)
    const asks = data.asks
      .map((ask: [string, string]) => ({
        price: ask[0],
        size: ask[1],
        total: (parseFloat(ask[0]) * parseFloat(ask[1])).toFixed(2)
      }))
      .slice(0, 10); // Limit to top 10 asks
    
    // Calculate depth (percentage for visualization)
    const maxTotal = Math.max(
      ...bids.map(b => parseFloat(b.total)),
      ...asks.map(a => parseFloat(a.total))
    );
    
    const bidsWithDepth = bids.map(bid => ({
      ...bid,
      depth: (parseFloat(bid.total) / maxTotal) * 100
    }));
    
    const asksWithDepth = asks.map(ask => ({
      ...ask,
      depth: (parseFloat(ask.total) / maxTotal) * 100
    }));
    
    // Calculate spread
    if (asks.length > 0 && bids.length > 0) {
      const lowestAsk = parseFloat(asks[0].price);
      const highestBid = parseFloat(bids[0].price);
      const spreadValue = lowestAsk - highestBid;
      const spreadPercentage = (spreadValue / lowestAsk) * 100;
      
      setOrderBookData({
        bids: bidsWithDepth,
        asks: asksWithDepth,
        spread: {
          value: spreadValue.toFixed(2),
          percentage: spreadPercentage.toFixed(3)
        }
      });
    }
  };
  
  // Update order book with deltas
  const updateOrderBook = (updates: any[]) => {
    // Real implementation would be more complex
    // For simplicity, we'll refetch the order book instead of applying deltas
    if (selectedMarket && apiKey && apiSecret) {
      fetch(`/api/products/${selectedMarket.product_id}/book`, {
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret
        }
      })
      .then(res => res.json())
      .then(data => processOrderBookData(data))
      .catch(err => console.error("Failed to update order book:", err));
    }
  };

  return (
    <div className="bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
      <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
        <h2 className="text-white font-medium">Order Book</h2>
        <div className="flex space-x-1">
          {["0.1", "0.5", "1.0"].map(value => (
            <button
              key={value}
              className={`px-2 py-1 text-xs rounded ${
                precision === value
                  ? 'bg-[#0052FF] bg-opacity-10 text-[#0052FF]'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setPrecision(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-64 overflow-y-auto">
        {status === "connecting" && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#0052FF]"></div>
            <span className="ml-2 text-sm text-gray-400">Connecting...</span>
          </div>
        )}
        
        {status === "closed" && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="material-icons mr-2">warning</span>
            WebSocket disconnected
          </div>
        )}
        
        {status === "open" && !selectedMarket && (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a market to view the order book
          </div>
        )}
        
        {status === "open" && selectedMarket && (
          <>
            <div className="grid grid-cols-3 text-xs text-gray-400 py-1 px-3">
              <div>Price (USD)</div>
              <div className="text-right">Amount ({selectedMarket.base_name})</div>
              <div className="text-right">Total (USD)</div>
            </div>
            
            {/* Sell orders (asks) */}
            {orderBookData.asks.map((ask, index) => (
              <div 
                key={`ask-${index}`} 
                className="order-book-row grid grid-cols-3 text-xs py-1 px-3 hover:bg-opacity-5 cursor-pointer"
              >
                <div className="text-[#FF3B30] font-mono">{parseFloat(ask.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="text-right font-mono">{parseFloat(ask.size).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}</div>
                <div className="text-right font-mono">{parseFloat(ask.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="col-span-3 relative">
                  <div className="absolute top-0 right-0 h-full bg-[#FF3B30] bg-opacity-10" style={{ width: `${ask.depth}%` }}></div>
                </div>
              </div>
            ))}
            
            {/* Spread indicator */}
            <div className="py-1 px-3 text-center text-xs text-gray-400 border-y border-[#3A3A3A]">
              Spread: <span className="font-medium text-gray-300">${orderBookData.spread.value} ({orderBookData.spread.percentage}%)</span>
            </div>
            
            {/* Buy orders (bids) */}
            {orderBookData.bids.map((bid, index) => (
              <div 
                key={`bid-${index}`} 
                className="order-book-row grid grid-cols-3 text-xs py-1 px-3 hover:bg-opacity-5 cursor-pointer"
              >
                <div className="text-[#05B169] font-mono">{parseFloat(bid.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="text-right font-mono">{parseFloat(bid.size).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}</div>
                <div className="text-right font-mono">{parseFloat(bid.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="col-span-3 relative">
                  <div className="absolute top-0 left-0 h-full bg-[#05B169] bg-opacity-10" style={{ width: `${bid.depth}%` }}></div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
