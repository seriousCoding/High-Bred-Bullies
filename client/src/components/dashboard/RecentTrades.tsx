import { useEffect, useState } from "react";
import { useMarkets } from "@/context/MarketsContext";
import { useApiKeys } from "@/hooks/use-api-keys";
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
  const lastFetchedMarketRef = React.useRef<string | null>(null);
  
  // Use layout effect to run synchronously before rendering and prevent the rerender cycle
  React.useLayoutEffect(() => {
    let isMounted = true;
    
    const fetchTrades = async () => {
      if (!selectedMarket) return;
      
      // Skip fetching if we've already fetched for this market
      if (lastFetchedMarketRef.current === selectedMarket.product_id) return;
      
      setLoading(true);
      
      try {
        // This endpoint does not require API credentials anymore as it uses the public Exchange API
        const response = await fetch(`/api/products/${selectedMarket.product_id}/trades`);
        
        if (!response.ok) {
          throw new Error(`Error fetching trades: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (Array.isArray(data) && isMounted) {
          setTrades(data.slice(0, 10)); // Show only 10 most recent trades
          lastFetchedMarketRef.current = selectedMarket.product_id;
        }
      } catch (error) {
        console.error("Failed to fetch trades:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    if (selectedMarket) {
      fetchTrades();
      
      // Subscribe to matches channel
      subscribe({
        type: "subscribe",
        product_ids: [selectedMarket.product_id],
        channel: "matches"
      });
    }
    
    return () => {
      isMounted = false;
      
      // Unsubscribe when unmounting or changing market
      if (selectedMarket) {
        subscribe({
          type: "unsubscribe",
          product_ids: [selectedMarket.product_id],
          channel: "matches"
        });
      }
    };
  }, [selectedMarket?.product_id, subscribe]);
  
  // Process WebSocket messages for new trades
  useEffect(() => {
    if (!messages.length || !selectedMarket) return;
    
    // Find match messages for the selected market
    const matchMessages = messages.filter(msg => 
      msg.channel === "matches" && 
      msg.events && 
      msg.events.length > 0 &&
      msg.events[0].trades && 
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
      
      // Add new trades to the beginning and keep only the latest 10
      setTrades(prev => [...newTrades, ...prev].slice(0, 10));
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
