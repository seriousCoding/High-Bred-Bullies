import { useQuery, useMutation } from "@tanstack/react-query";
import { useApiKeys } from "@/hooks/use-api-keys";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function OpenOrdersTable() {
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { toast } = useToast();
  
  // Fetch open orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ['/api/orders', 'OPEN'],
    enabled: hasKeys,
    queryFn: async () => {
      const res = await fetch('/api/orders?order_status=OPEN', {
        headers: {
          'x-api-key': apiKey!,
          'x-api-secret': apiSecret!
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      return res.json();
    },
    refetchInterval: 10000 // Refresh every 10 seconds
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

  return (
    <div className="col-span-12 md:col-span-4 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
      <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
        <h2 className="text-white font-medium">Open Orders</h2>
        <Link href="/orders" className="text-[#0052FF] hover:text-blue-400 text-sm">View All</Link>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#3A3A3A]">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pair</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Size/Price</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3A3A3A]">
            {!hasKeys && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <div className="text-gray-400 text-sm">Connect API keys to view orders</div>
                </td>
              </tr>
            )}
            
            {hasKeys && isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#0052FF]"></div>
                  </div>
                </td>
              </tr>
            )}
            
            {hasKeys && !isLoading && (!orders || orders.length === 0) && (
              <tr className="hover:bg-dark-bg">
                <td colSpan={4} className="px-4 py-8 text-center">
                  <div className="text-gray-400 text-sm">No open orders</div>
                  <div className="text-xs text-gray-500 mt-1">Your open orders will appear here</div>
                </td>
              </tr>
            )}
            
            {hasKeys && !isLoading && orders && orders.length > 0 && (
              orders.slice(0, 5).map((order: any) => {
                const { size, price } = getOrderDetails(order);
                const baseCurrency = order.product_id.split('-')[0];
                
                return (
                  <tr key={order.order_id} className="hover:bg-dark-bg">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{order.product_id}</div>
                      <div className="text-xs text-gray-400">
                        {formatOrderType(order)} {order.side.toLowerCase()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className={`text-xs font-medium ${
                        order.side === 'BUY' ? 'text-[#05B169]' : 'text-[#FF3B30]'
                      }`}>
                        {order.side.charAt(0) + order.side.slice(1).toLowerCase()}
                      </div>
                      <div className="text-xs text-gray-400">{formatOrderType(order)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-mono text-white">{size} {baseCurrency}</div>
                      <div className="text-xs font-mono text-gray-400">
                        @ {price === "Market Price" ? price : `$${parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button 
                        className="text-[#FF3B30] hover:text-red-400" 
                        onClick={() => handleCancelOrder(order.order_id)}
                        disabled={cancelMutation.isPending}
                      >
                        <span className="material-icons text-sm">
                          {cancelMutation.isPending && cancelMutation.variables === order.order_id ? 'hourglass_empty' : 'close'}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
