import * as React from "react";
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

export const MarketsContext = React.createContext<MarketsContextType>({
  markets: [],
  selectedMarket: null,
  setSelectedMarket: () => {},
  isLoading: false,
  error: null
});

interface MarketsProviderProps {
  children: React.ReactNode;
}

export function MarketsProvider({ children }: MarketsProviderProps) {
  const [markets, setMarkets] = React.useState<Product[]>([]);
  const [selectedMarket, setSelectedMarket] = React.useState<Product | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { subscribe, messages } = useWebSocket();
  
  // Fetch products - can work with or without API keys
  React.useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Create headers based on whether we have API keys or not
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Add API keys to headers if available
        if (hasKeys && apiKey && apiSecret) {
          headers['x-api-key'] = apiKey;
          headers['x-api-secret'] = apiSecret;
        }
        
        // Make the API request with or without authentication
        const response = await fetch('/api/products', { headers });
        
        if (!response.ok) {
          throw new Error(`Error fetching products: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Filter out products with placeholder/default/zero values
          const realProducts = data.filter(product => {
            return product.price !== "0" && 
                  parseFloat(product.price || "0") > 0 &&
                  product.volume_24h !== "0" && 
                  parseFloat(product.volume_24h || "0") > 0;
          });
          
          // Sort products by volume (descending)
          const sortedProducts = [...realProducts].sort((a, b) => {
            const volumeA = parseFloat(a.volume_24h) || 0;
            const volumeB = parseFloat(b.volume_24h) || 0;
            return volumeB - volumeA;
          });
          
          console.log(`Loaded ${sortedProducts.length} active markets from API`);
          setMarkets(sortedProducts);
          
          // Set BTC-USD as default selected market, or first product if not available
          const btcUsd = sortedProducts.find(p => p.product_id === 'BTC-USD');
          setSelectedMarket(btcUsd || sortedProducts[0] || null);
        } else {
          throw new Error('Invalid data format received from API');
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
    
    // Refresh market data every 5 minutes
    const refreshInterval = setInterval(fetchProducts, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [hasKeys, apiKey, apiSecret]);
  
  // Subscribe to ticker updates via WebSocket
  React.useEffect(() => {
    if (markets.length === 0) return;
    
    // Get product IDs for top 20 markets (by volume)
    const productIds = markets.slice(0, 20).map((market: Product) => market.product_id);
    
    console.log(`Subscribing to ticker updates for ${productIds.length} markets`);
    
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
  }, [markets.length, subscribe]);
  
  // Process WebSocket messages for ticker updates
  React.useEffect(() => {
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
      setMarkets((prev: Product[]) => {
        const updatedMarkets = [...prev];
        let shouldUpdateSelectedMarket = false;
        let updatedSelectedMarket: Product | null = null;
        
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
              
              // Store the updated market if it's the selected one
              if (selectedMarket && selectedMarket.product_id === ticker.product_id) {
                shouldUpdateSelectedMarket = true;
                updatedSelectedMarket = updatedMarkets[marketIndex];
              }
            }
          });
        });
        
        // Update the selected market outside the loop to avoid multiple state updates
        if (shouldUpdateSelectedMarket && updatedSelectedMarket) {
          // Use setTimeout to avoid state updates during render
          setTimeout(() => {
            setSelectedMarket(updatedSelectedMarket);
          }, 0);
        }
        
        return updatedMarkets;
      });
    }
  }, [messages]); // Removed selectedMarket from dependencies

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
  return React.useContext(MarketsContext);
}
