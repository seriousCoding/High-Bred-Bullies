import { useState, useContext } from "react";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useMarkets } from "@/context/MarketsContext";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";

interface TopBarProps {
  onApiKeyModalOpen: () => void;
}

export function TopBar({ onApiKeyModalOpen }: TopBarProps) {
  const { selectedMarket, setSelectedMarket, markets } = useMarkets();
  const { hasKeys } = useApiKeys();

  return (
    <header className="bg-card-bg border-b border-[#3A3A3A] h-16 flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center">
        <div className="relative mr-4">
          <select 
            className="bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-1.5 pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0052FF] appearance-none"
            value={selectedMarket?.product_id || ""}
            onChange={(e) => {
              const market = markets.find((m: any) => m.product_id === e.target.value);
              if (market) setSelectedMarket(market);
            }}
            disabled={!hasKeys || markets.length === 0}
          >
            {markets.length === 0 ? (
              <option value="">Loading markets...</option>
            ) : (
              markets.map((market: any) => (
                <option key={market.product_id} value={market.product_id}>
                  {market.product_id}
                </option>
              ))
            )}
          </select>
          <span className="material-icons absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
            expand_more
          </span>
        </div>
        
        {selectedMarket && (
          <div className="flex items-center space-x-6">
            <div>
              <div className="text-xl font-medium font-mono text-white">
                ${parseFloat(selectedMarket.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-xs font-medium ${
                parseFloat(selectedMarket.price_percentage_change_24h) >= 0 
                  ? 'text-[#05B169]' 
                  : 'text-[#FF3B30]'
              }`}>
                {parseFloat(selectedMarket.price_percentage_change_24h) >= 0 ? '+' : ''}
                {parseFloat(selectedMarket.price_percentage_change_24h).toFixed(2)}%
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="text-xs text-gray-400">24h Volume</div>
              <div className="text-sm font-medium font-mono">
                ${(parseFloat(selectedMarket.volume_24h) / 1000000).toFixed(1)}M
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="text-xs text-gray-400">Base Min</div>
              <div className="text-sm font-medium font-mono">
                {selectedMarket.base_min_size} {selectedMarket.base_name}
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="text-xs text-gray-400">Base Max</div>
              <div className="text-sm font-medium font-mono">
                {selectedMarket.base_max_size} {selectedMarket.base_name}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <button 
          onClick={onApiKeyModalOpen}
          className="bg-[#0052FF] bg-opacity-10 text-[#0052FF] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-opacity-20 flex items-center"
        >
          <span className="material-icons text-sm mr-1">vpn_key</span>
          <span className="hidden sm:inline">API Keys</span>
        </button>
        
        <div className="relative ml-4">
          <button className="text-gray-300 hover:text-white">
            <span className="material-icons">notifications</span>
          </button>
          <span className="absolute top-0 right-0 h-2 w-2 bg-[#FF3B30] rounded-full"></span>
        </div>
      </div>
    </header>
  );
}
