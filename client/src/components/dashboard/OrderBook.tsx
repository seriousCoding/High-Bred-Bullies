import { useState } from "react";
import { useMarkets } from "@/context/MarketsContext";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useWebSocket } from "@/hooks/use-websocket";
import { useMarketData } from "@/hooks/use-market-data";

export function OrderBook() {
  const [precision, setPrecision] = useState<string>("0.1");
  const { selectedMarket } = useMarkets();
  const { isAuthenticated } = useApiKeys();
  const { status } = useWebSocket();
  
  // Use our custom hook to get live market data
  const productId = selectedMarket?.product_id || '';
  const { orderBook, isLoading } = useMarketData(productId);
  
  // Render the order book data with proper formatting
  const renderOrderBook = () => {
    if (!selectedMarket) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          Select a market to view the order book
        </div>
      );
    }
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#0052FF]"></div>
          <span className="ml-2 text-sm text-gray-400">Loading order book...</span>
        </div>
      );
    }
    
    if (!orderBook.bids.length && !orderBook.asks.length) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          No order book data available
        </div>
      );
    }
    
    return (
      <>
        <div className="grid grid-cols-3 text-xs text-gray-400 py-1 px-3">
          <div>Price (USD)</div>
          <div className="text-right">Amount ({selectedMarket.base_name})</div>
          <div className="text-right">Total (USD)</div>
        </div>
        
        {/* Sell orders (asks) */}
        {orderBook.asks.map((ask, index) => (
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
          Spread: <span className="font-medium text-gray-300">${orderBook.spread.value} ({orderBook.spread.percentage}%)</span>
        </div>
        
        {/* Buy orders (bids) */}
        {orderBook.bids.map((bid, index) => (
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
    );
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
        
        {status === "open" && renderOrderBook()}
      </div>
    </div>
  );
}
