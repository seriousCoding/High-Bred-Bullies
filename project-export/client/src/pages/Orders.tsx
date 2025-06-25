import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApiKeys } from "@/hooks/use-api-keys";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type OrderStatus = "OPEN" | "FILLED" | "CANCELLED" | "EXPIRED" | "FAILED" | "ALL";

export default function Orders() {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("OPEN");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("1D");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch orders based on selected status
  const { data: orders, isLoading } = useQuery({
    queryKey: ['/api/orders', selectedStatus],
    enabled: hasKeys,
    queryFn: async () => {
      const status = selectedStatus === "ALL" ? "" : selectedStatus;
      const res = await fetch(`/api/orders${status ? `?order_status=${status}` : ''}`, {
        headers: {
          'x-api-key': apiKey!,
          'x-api-secret': apiSecret!
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      return res.json();
    }
  });
  
  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest("DELETE", `/api/orders/${orderId}`, null);
    },
    onSuccess: () => {
      toast({
        title: "Order cancelled",
        description: "Your order has been cancelled successfully",
        variant: "default"
      });
      
      // Refresh orders
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel order",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
    }
  });
  
  // Handle order cancellation
  const handleCancelOrder = (orderId: string) => {
    cancelMutation.mutate(orderId);
  };
  
  // Format order type for display
  const formatOrderType = (order: any) => {
    if (order.order_configuration.market_market_ioc) {
      return "Market";
    } else if (order.order_configuration.limit_limit_gtc) {
      return "Limit";
    } else if (order.order_configuration.stop_limit_stop_limit_gtc) {
      return "Stop Limit";
    }
    return "Unknown";
  };
  
  // Get order price and size
  const getOrderDetails = (order: any) => {
    let size = "";
    let price = "";
    
    if (order.order_configuration.market_market_ioc) {
      size = order.order_configuration.market_market_ioc.base_size || order.order_configuration.market_market_ioc.quote_size || "";
      price = "Market Price";
    } else if (order.order_configuration.limit_limit_gtc) {
      size = order.order_configuration.limit_limit_gtc.base_size || "";
      price = order.order_configuration.limit_limit_gtc.limit_price || "";
    } else if (order.order_configuration.stop_limit_stop_limit_gtc) {
      size = order.order_configuration.stop_limit_stop_limit_gtc.base_size || "";
      price = order.order_configuration.stop_limit_stop_limit_gtc.limit_price || "";
    }
    
    return { size, price };
  };
  
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

  // Filter orders based on search term
  const filteredOrders = orders && Array.isArray(orders) 
    ? orders.filter(order => 
        order.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onApiKeyModalOpen={() => setIsApiKeyModalOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-4 border-b border-[#3A3A3A] flex flex-col md:flex-row justify-between space-y-2 md:space-y-0">
                <h2 className="text-xl font-medium text-white">Orders</h2>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-md overflow-hidden">
                    {(['OPEN', 'FILLED', 'CANCELLED', 'ALL'] as OrderStatus[]).map(status => (
                      <button
                        key={status}
                        className={`px-3 py-1.5 text-sm ${
                          selectedStatus === status
                            ? 'bg-[#0052FF] text-white'
                            : 'bg-card-bg border-l border-[#3A3A3A] text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setSelectedStatus(status)}
                      >
                        {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search orders..."
                      className="bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF] w-full md:w-auto"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="material-icons absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      search
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                {!hasKeys && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <span className="material-icons text-4xl mb-3">receipt_long</span>
                    <p className="text-lg mb-1">Connect API keys to view your orders</p>
                    <p className="text-sm">You'll need to connect your Coinbase Advanced Trade API keys first</p>
                    <button
                      className="mt-4 px-4 py-2 bg-[#0052FF] text-white rounded-md hover:bg-blue-600 transition-colors"
                      onClick={() => setIsApiKeyModalOpen(true)}
                    >
                      Connect API Keys
                    </button>
                  </div>
                )}
                
                {hasKeys && isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0052FF]"></div>
                  </div>
                )}
                
                {hasKeys && !isLoading && (!filteredOrders || filteredOrders.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <span className="material-icons text-4xl mb-3">receipt_long</span>
                    <p className="text-lg mb-1">No orders found</p>
                    {searchTerm ? (
                      <p className="text-sm">Try adjusting your search or filters</p>
                    ) : (
                      <p className="text-sm">You don't have any {selectedStatus.toLowerCase()} orders</p>
                    )}
                  </div>
                )}
                
                {hasKeys && !isLoading && filteredOrders && filteredOrders.length > 0 && (
                  <table className="min-w-full divide-y divide-[#3A3A3A]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type / Side</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Size / Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3A3A3A]">
                      {filteredOrders.map((order) => {
                        const { size, price } = getOrderDetails(order);
                        const baseCurrency = order.product_id.split('-')[0];
                        
                        return (
                          <tr key={order.order_id} className="hover:bg-dark-bg">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">{order.product_id}</div>
                              <div className="text-xs text-gray-400">{order.order_id.substring(0, 8)}...</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">{formatOrderType(order)}</div>
                              <div className={`text-xs font-medium ${
                                order.side === 'BUY' ? 'text-[#05B169]' : 'text-[#FF3B30]'
                              }`}>
                                {order.side.charAt(0) + order.side.slice(1).toLowerCase()}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-mono text-white">{size} {baseCurrency}</div>
                              <div className="text-xs font-mono text-gray-400">
                                @ {price === "Market Price" ? price : `$${parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                order.status === 'OPEN' ? 'bg-blue-900 bg-opacity-30 text-blue-400' :
                                order.status === 'FILLED' ? 'bg-green-900 bg-opacity-30 text-green-400' :
                                order.status === 'CANCELLED' ? 'bg-gray-900 bg-opacity-30 text-gray-400' :
                                'bg-red-900 bg-opacity-30 text-red-400'
                              }`}>
                                {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                              </div>
                              {order.completion_percentage !== "0" && order.completion_percentage !== "1" && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {(parseFloat(order.completion_percentage) * 100).toFixed(0)}% filled
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-white">{formatDate(order.created_time)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {order.status === 'OPEN' && (
                                <button 
                                  className="text-[#FF3B30] hover:text-red-400 px-3 py-1 rounded-md border border-[#FF3B30] hover:border-red-400 text-sm" 
                                  onClick={() => handleCancelOrder(order.order_id)}
                                  disabled={cancelMutation.isPending && cancelMutation.variables === order.order_id}
                                >
                                  {cancelMutation.isPending && cancelMutation.variables === order.order_id ? (
                                    <span className="flex items-center">
                                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Cancelling...
                                    </span>
                                  ) : (
                                    'Cancel'
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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
