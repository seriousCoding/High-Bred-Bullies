import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApiKeys } from "@/hooks/use-api-keys";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type HistoryTab = "fills" | "deposits-withdrawals";

export default function History() {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTab, setCurrentTab] = useState<HistoryTab>("fills");
  
  // Fetch fill history
  const { data: fills, isLoading: isLoadingFills } = useQuery({
    queryKey: ['/api/fills'],
    enabled: hasKeys && currentTab === "fills",
    queryFn: async () => {
      const res = await fetch('/api/fills', {
        headers: {
          'x-api-key': apiKey!,
          'x-api-secret': apiSecret!
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch fill history');
      }
      
      return res.json();
    }
  });
  
  // Filter fills based on search term
  const filteredFills = fills && Array.isArray(fills) 
    ? fills.filter(fill => 
        fill.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fill.order_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Format currency
  const formatCurrency = (value: string, decimals: number = 2) => {
    return parseFloat(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onApiKeyModalOpen={() => setIsApiKeyModalOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-4 border-b border-[#3A3A3A] flex flex-col md:flex-row justify-between space-y-2 md:space-y-0">
                <h2 className="text-xl font-medium text-white">Transaction History</h2>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    className="bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF] w-full md:w-auto"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="material-icons absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                    search
                  </span>
                </div>
              </div>
              
              <Tabs 
                defaultValue="fills" 
                value={currentTab}
                onValueChange={(value) => setCurrentTab(value as HistoryTab)}
                className="w-full"
              >
                <div className="border-b border-[#3A3A3A]">
                  <TabsList className="bg-transparent">
                    <TabsTrigger value="fills" className="data-[state=active]:text-[#0052FF] data-[state=active]:border-b-2 data-[state=active]:border-[#0052FF] data-[state=active]:shadow-none rounded-none text-gray-400 py-2 px-4">
                      Trade Fills
                    </TabsTrigger>
                    <TabsTrigger value="deposits-withdrawals" className="data-[state=active]:text-[#0052FF] data-[state=active]:border-b-2 data-[state=active]:border-[#0052FF] data-[state=active]:shadow-none rounded-none text-gray-400 py-2 px-4">
                      Deposits & Withdrawals
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="fills" className="m-0">
                  {!hasKeys && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <span className="material-icons text-4xl mb-3">receipt_long</span>
                      <p className="text-lg mb-1">Connect API keys to view your trade history</p>
                      <p className="text-sm">You'll need to connect your Coinbase Advanced Trade API keys first</p>
                      <button
                        className="mt-4 px-4 py-2 bg-[#0052FF] text-white rounded-md hover:bg-blue-600 transition-colors"
                        onClick={() => setIsApiKeyModalOpen(true)}
                      >
                        Connect API Keys
                      </button>
                    </div>
                  )}
                  
                  {hasKeys && isLoadingFills && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0052FF]"></div>
                    </div>
                  )}
                  
                  {hasKeys && !isLoadingFills && (!filteredFills || filteredFills.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <span className="material-icons text-4xl mb-3">history</span>
                      <p className="text-lg mb-1">No trade fills found</p>
                      {searchTerm ? (
                        <p className="text-sm">Try adjusting your search</p>
                      ) : (
                        <p className="text-sm">You don't have any trade fills yet</p>
                      )}
                    </div>
                  )}
                  
                  {hasKeys && !isLoadingFills && filteredFills && filteredFills.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-[#3A3A3A]">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Side</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fee</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#3A3A3A]">
                          {filteredFills.map((fill) => {
                            const [baseCurrency, quoteCurrency] = fill.product_id.split('-');
                            const total = parseFloat(fill.price) * parseFloat(fill.size);
                            
                            return (
                              <tr key={fill.trade_id} className="hover:bg-dark-bg">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-white">{fill.product_id}</div>
                                  <div className="text-xs text-gray-400">Trade #{fill.trade_id}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className={`text-sm font-medium ${
                                    fill.side === 'BUY' ? 'text-[#05B169]' : 'text-[#FF3B30]'
                                  }`}>
                                    {fill.side.charAt(0) + fill.side.slice(1).toLowerCase()}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-mono text-white">
                                    {formatCurrency(fill.size, 8)} {baseCurrency}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-mono text-white">
                                    ${formatCurrency(fill.price)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-mono text-white">
                                    ${formatCurrency(fill.fee)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-mono text-white">
                                    ${total.toLocaleString(undefined, { 
                                      minimumFractionDigits: 2, 
                                      maximumFractionDigits: 2 
                                    })}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm text-white">{formatDate(fill.time)}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="deposits-withdrawals" className="m-0">
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <span className="material-icons text-4xl mb-3">account_balance_wallet</span>
                    <p className="text-lg mb-1">Deposits & Withdrawals History</p>
                    <p className="text-sm">This feature is coming soon</p>
                  </div>
                </TabsContent>
              </Tabs>
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
