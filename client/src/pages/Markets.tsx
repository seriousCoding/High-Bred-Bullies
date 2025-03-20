import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useMarkets } from "@/context/MarketsContext";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { OrderBook } from "@/components/dashboard/OrderBook";

export default function Markets() {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { markets, selectedMarket, setSelectedMarket } = useMarkets();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("volume");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch all products
  const { data: products, isLoading } = useQuery({
    queryKey: ['/api/products'],
    enabled: hasKeys,
    queryFn: async () => {
      const res = await fetch('/api/products', {
        headers: {
          'x-api-key': apiKey!,
          'x-api-secret': apiSecret!
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch products');
      }
      
      return res.json();
    }
  });

  // Filter and sort products
  const filteredProducts = markets.filter(product => 
    product.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.base_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.quote_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case "name":
        valueA = a.product_id;
        valueB = b.product_id;
        break;
      case "price":
        valueA = parseFloat(a.price);
        valueB = parseFloat(b.price);
        break;
      case "change":
        valueA = parseFloat(a.price_percentage_change_24h);
        valueB = parseFloat(b.price_percentage_change_24h);
        break;
      case "volume":
      default:
        valueA = parseFloat(a.volume_24h);
        valueB = parseFloat(b.volume_24h);
        break;
    }
    
    return sortDirection === "asc" 
      ? valueA > valueB ? 1 : -1
      : valueA < valueB ? 1 : -1;
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("desc");
    }
  };

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onApiKeyModalOpen={() => setIsApiKeyModalOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-4 p-4">
            {/* Markets List */}
            <div className="col-span-12 md:col-span-4 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-3 border-b border-[#3A3A3A]">
                <h2 className="text-white font-medium mb-2">Markets</h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search markets..."
                    className="w-full bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="material-icons absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">
                    search
                  </span>
                </div>
              </div>
              
              <div className="overflow-y-auto max-h-[calc(100vh-240px)]">
                {!hasKeys && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <span className="material-icons text-3xl mb-2">vpn_key</span>
                    <p className="text-sm">Connect API keys to view markets</p>
                  </div>
                )}
                
                {hasKeys && isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0052FF]"></div>
                  </div>
                )}
                
                {hasKeys && !isLoading && (
                  <>
                    <div className="grid grid-cols-3 text-xs font-medium text-gray-400 py-2 px-3 sticky top-0 bg-card-bg border-b border-[#3A3A3A]">
                      <div 
                        className="cursor-pointer flex items-center" 
                        onClick={() => handleSort("name")}
                      >
                        <span>Pair</span>
                        {sortBy === "name" && (
                          <span className="material-icons text-xs ml-1">
                            {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                          </span>
                        )}
                      </div>
                      <div 
                        className="text-right cursor-pointer flex items-center justify-end" 
                        onClick={() => handleSort("price")}
                      >
                        <span>Price</span>
                        {sortBy === "price" && (
                          <span className="material-icons text-xs ml-1">
                            {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                          </span>
                        )}
                      </div>
                      <div 
                        className="text-right cursor-pointer flex items-center justify-end" 
                        onClick={() => handleSort("change")}
                      >
                        <span>24h</span>
                        {sortBy === "change" && (
                          <span className="material-icons text-xs ml-1">
                            {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {sortedProducts.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        No markets found matching "{searchTerm}"
                      </div>
                    ) : (
                      sortedProducts.map((product) => (
                        <div 
                          key={product.product_id}
                          className={`grid grid-cols-3 py-3 px-3 hover:bg-dark-bg cursor-pointer border-b border-[#3A3A3A] ${
                            selectedMarket?.product_id === product.product_id ? 'bg-[#0052FF] bg-opacity-5' : ''
                          }`}
                          onClick={() => setSelectedMarket(product)}
                        >
                          <div className="flex items-center">
                            <div className="mr-2 w-6 h-6 rounded-full bg-[#0052FF] bg-opacity-10 flex items-center justify-center">
                              <span className="text-xs font-medium text-[#0052FF]">
                                {product.base_name.substring(0, 3)}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{product.product_id}</div>
                              <div className="text-xs text-gray-400">{product.base_name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-white">
                              ${parseFloat(product.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              parseFloat(product.price_percentage_change_24h) >= 0 
                                ? 'text-[#05B169]' 
                                : 'text-[#FF3B30]'
                            }`}>
                              {parseFloat(product.price_percentage_change_24h) >= 0 ? '+' : ''}
                              {parseFloat(product.price_percentage_change_24h).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Market Details */}
            <div className="col-span-12 md:col-span-8">
              <div className="grid grid-cols-1 gap-4">
                <PriceChart />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <OrderBook />
                  <div className="bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
                    <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
                      <h2 className="text-white font-medium">Market Info</h2>
                    </div>
                    
                    {selectedMarket ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <h3 className="text-gray-400 text-sm mb-2">Trading Details</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-400">24h Volume</div>
                              <div className="text-sm font-medium font-mono">
                                ${parseFloat(selectedMarket.volume_24h).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Volume Change</div>
                              <div className={`text-sm font-medium ${
                                parseFloat(selectedMarket.volume_percentage_change_24h) >= 0 
                                  ? 'text-[#05B169]' 
                                  : 'text-[#FF3B30]'
                              }`}>
                                {parseFloat(selectedMarket.volume_percentage_change_24h) >= 0 ? '+' : ''}
                                {parseFloat(selectedMarket.volume_percentage_change_24h).toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-gray-400 text-sm mb-2">Size Limits</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-400">Base Min</div>
                              <div className="text-sm font-medium font-mono">
                                {selectedMarket.base_min_size} {selectedMarket.base_name}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Base Max</div>
                              <div className="text-sm font-medium font-mono">
                                {selectedMarket.base_max_size} {selectedMarket.base_name}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Quote Min</div>
                              <div className="text-sm font-medium font-mono">
                                {selectedMarket.quote_min_size} {selectedMarket.quote_name}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Quote Max</div>
                              <div className="text-sm font-medium font-mono">
                                {selectedMarket.quote_max_size} {selectedMarket.quote_name}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-gray-400 text-sm mb-2">Status</h3>
                          <div className="flex space-x-4">
                            <div className="flex items-center">
                              <div className={`w-2 h-2 rounded-full ${selectedMarket.status === 'online' ? 'bg-[#05B169]' : 'bg-[#FF3B30]'} mr-2`}></div>
                              <span className="text-sm font-medium capitalize">{selectedMarket.status}</span>
                            </div>
                            <div className="text-xs text-gray-400 flex items-center">
                              {selectedMarket.trading_disabled ? (
                                <span className="flex items-center text-[#FF3B30]">
                                  <span className="material-icons text-xs mr-1">block</span>
                                  Trading Disabled
                                </span>
                              ) : (
                                <span className="flex items-center text-[#05B169]">
                                  <span className="material-icons text-xs mr-1">check_circle</span>
                                  Trading Enabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-400">
                        Select a market to view details
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        {/* API Key Modal */}
        <ApiKeyModal 
          isOpen={isApiKeyModalOpen} 
          onClose={() => setIsApiKeyModalOpen(false)}
        />
      </div>
    </>
  );
}
