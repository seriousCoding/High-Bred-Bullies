import { useEffect, useState, useCallback, useRef } from "react";
import { useMarkets } from "@/context/MarketsContext";
import { useWebSocket } from "@/hooks/use-websocket";

type Trade = {
  trade_id: string;
  price: string;
  size: string;
  time: string;
  side: "buy" | "sell";
};

export function RecentTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedMarket } = useMarkets();
  const { subscribe, messages, status } = useWebSocket();
  const lastFetchedMarketRef = useRef<string | null>(null);
  const lastMessagesLengthRef = useRef(0);
  
  // Define fetchTrades as a memoized callback to prevent it from being recreated on each render
  const fetchTrades = useCallback(async (productId: string) => {
    if (lastFetchedMarketRef.current === productId) return;
    
    setLoading(true);
    
    try {
      // This endpoint does not require API credentials anymore as it uses the public Exchange API
      const response = await fetch(`/api/products/${productId}/trades`);
      
      if (!response.ok) {
        throw new Error(`Error fetching trades: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setTrades(data.slice(0, 10)); // Show only 10 most recent trades
        lastFetchedMarketRef.current = productId;
      }
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Handle market selection changes
  useEffect(() => {
    if (!selectedMarket) return;
    
    const productId = selectedMarket.product_id;
    
    // Fetch trades for the selected market
    fetchTrades(productId);
    
    // Subscribe to matches channel
    subscribe({
      type: "subscribe",
      product_ids: [productId],
      channel: "matches"
    });
    
    return () => {
      // Unsubscribe when unmounting or changing market
      subscribe({
        type: "unsubscribe",
        product_ids: [productId],
        channel: "matches"
      });
    };
  }, [selectedMarket, subscribe, fetchTrades]);
  
  // Process WebSocket messages for new trades
  useEffect(() => {
    if (!messages.length || !selectedMarket || messages.length === lastMessagesLengthRef.current) return;
    
    // Update the reference to avoid processing the same messages again
    lastMessagesLengthRef.current = messages.length;
    
    // Get only the new messages since last check
    const newMessages = messages.slice(-5); // Just check the last 5 messages to avoid performance issues
    
    // Find match messages for the selected market
    const matchMessages = newMessages.filter(msg => 
      msg.channel === "matches" && 
      msg.events && 
      msg.events.length > 0 &&
      msg.events[0]?.trades && 
      msg.events[0].trades.some((t: any) => t.product_id === selectedMarket.product_id)
    );
    
    if (matchMessages.length > 0) {
      // Process all new trades
      const newTrades = matchMessages.flatMap(msg => 
        msg.events[0].trades
          .filter((t: any) => t.product_id === selectedMarket.product_id)
          .map((t: any) => ({
            trade_id: t.trade_id,
            price: t.price,
            size: t.size,
            time: t.time,
            side: t.side
          }))
      );
      
      if (newTrades.length > 0) {
        // Add new trades to the beginning and keep only the latest 10
        setTrades(prev => [...newTrades, ...prev].slice(0, 10));
      }
    }
  }, [messages, selectedMarket]);
  
  // Format time (HH:MM:SS)
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
      <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
        <h2 className="text-white font-medium">Recent Trades</h2>
      </div>
      
      <div className="h-40 overflow-y-auto">
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
            Select a market to view recent trades
          </div>
        )}
        
        {status === "open" && selectedMarket && (
          <>
            <div className="grid grid-cols-3 text-xs text-gray-400 py-1 px-3">
              <div>Price (USD)</div>
              <div className="text-right">Amount ({selectedMarket.base_name})</div>
              <div className="text-right">Time</div>
            </div>
            
            {trades.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                No trades found
              </div>
            ) : (
              trades.map((trade) => (
                <div 
                  key={trade.trade_id} 
                  className="grid grid-cols-3 text-xs py-1 px-3 hover:bg-gray-700 cursor-pointer"
                >
                  <div className={`${
                    trade.side === "buy" ? "text-[#05B169]" : "text-[#FF3B30]"
                  } font-mono`}>
                    {parseFloat(trade.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-right font-mono">
                    {parseFloat(trade.size).toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })}
                  </div>
                  <div className="text-right text-gray-400">
                    {formatTime(trade.time)}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
