import { createContext, useState, useEffect, ReactNode } from "react";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useWebSocket } from "@/hooks/use-websocket";

interface Product {
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

interface MarketsContextType {
  markets: Product[];
  selectedMarket: Product | null;
  setSelectedMarket: (market: Product) => void;
  isLoading: boolean;
  error: Error | null;
}

export const MarketsContext = createContext<MarketsContextType>({
  markets: [],
  selectedMarket: null,
  setSelectedMarket: () => {},
  isLoading: false,
  error: null
});

interface MarketsProviderProps {
  children: ReactNode;
}

export function MarketsProvider({ children }: MarketsProviderProps) {
  const [markets, setMarkets] = useState<Product[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { subscribe, messages } = useWebSocket();
  
  // Fetch products when API keys are available
  useEffect(() => {
    if (!hasKeys) return;
    
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/products', {
          headers: {
            'x-api-key': apiKey!,
            'x-api-secret': apiSecret!
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching products: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Sort products by volume
          const sortedProducts = [...data].sort((a, b) => 
            parseFloat(b.volume_24h) - parseFloat(a.volume_24h)
          );
          
          setMarkets(sortedProducts);
          
          // Set BTC-USD as default selected market, or first product if not available
          const btcUsd = sortedProducts.find(p => p.product_id === 'BTC-USD');
          setSelectedMarket(btcUsd || sortedProducts[0] || null);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
  }, [hasKeys, apiKey, apiSecret]);
  
  // Subscribe to ticker updates via WebSocket
  useEffect(() => {
    if (!hasKeys || markets.length === 0) return;
    
    // Get product IDs for top 20 markets (by volume)
    const productIds = markets.slice(0, 20).map(market => market.product_id);
    
    // Subscribe to ticker channel
    subscribe({
      type: "subscribe",
      product_ids: productIds,
      channel: "ticker"
    });
    
    return () => {
      // Unsubscribe when unmounting
      subscribe({
        type: "unsubscribe",
        product_ids: productIds,
        channel: "ticker"
      });
    };
  }, [hasKeys, markets.length > 0]);
  
  // Process WebSocket messages for ticker updates
  useEffect(() => {
    if (!messages.length) return;
    
    // Find ticker messages
    const tickerMessages = messages.filter(msg => 
      msg.channel === "ticker" && 
      msg.events && 
      msg.events.length > 0 &&
      msg.events[0].tickers
    );
    
    if (tickerMessages.length > 0) {
      // Update markets with latest ticker data
      setMarkets(prev => {
        const updatedMarkets = [...prev];
        
        tickerMessages.forEach(msg => {
          msg.events[0].tickers.forEach((ticker: any) => {
            const marketIndex = updatedMarkets.findIndex(m => m.product_id === ticker.product_id);
            
            if (marketIndex >= 0) {
              updatedMarkets[marketIndex] = {
                ...updatedMarkets[marketIndex],
                price: ticker.price,
                price_percentage_change_24h: ticker.price_percent_chg_24h,
                volume_24h: ticker.volume_24h,
                // Other ticker fields can be updated here
              };
              
              // Also update selected market if it's the one that changed
              if (selectedMarket && selectedMarket.product_id === ticker.product_id) {
                setSelectedMarket(updatedMarkets[marketIndex]);
              }
            }
          });
        });
        
        return updatedMarkets;
      });
    }
  }, [messages]);

  return (
    <MarketsContext.Provider
      value={{
        markets,
        selectedMarket,
        setSelectedMarket,
        isLoading,
        error
      }}
    >
      {children}
    </MarketsContext.Provider>
  );
}

export function useMarkets() {
  return useContext(MarketsContext);
}
