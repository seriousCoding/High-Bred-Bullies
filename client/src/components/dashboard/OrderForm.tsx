import { useState, useEffect } from "react";
import { useMarkets } from "@/context/MarketsContext";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OrderSide, OrderType } from "@shared/coinbase-api-types";

type OrderFormMode = "buy" | "sell";
type PaymentType = "fiat" | "crypto";

export function OrderForm() {
  // Form state
  const [mode, setMode] = useState<OrderFormMode>("buy");
  const [orderType, setOrderType] = useState<OrderType>(OrderType.MARKET);
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  
  // Context and hooks
  const { selectedMarket } = useMarkets();
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { toast } = useToast();
  
  // Fetch accounts for the dropdown
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['/api/accounts'],
    enabled: hasKeys,
    queryFn: async () => {
      const res = await fetch('/api/accounts', {
        headers: {
          'x-api-key': apiKey!,
          'x-api-secret': apiSecret!
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch accounts');
      }
      
      return res.json();
    }
  });
  
  // Update limitPrice when selected market changes
  useEffect(() => {
    if (selectedMarket) {
      setLimitPrice(selectedMarket.price);
    }
  }, [selectedMarket]);
  
  // Set default account when accounts are loaded
  useEffect(() => {
    if (accounts && Array.isArray(accounts) && accounts.length > 0) {
      // For buy, select USD account
      if (mode === "buy") {
        const usdAccount = accounts.find((acc: any) => acc.currency === "USD");
        if (usdAccount) {
          setSelectedAccount(usdAccount.account_id);
        } else {
          setSelectedAccount(accounts[0].account_id);
        }
      }
      // For sell, select the base currency account
      else if (mode === "sell" && selectedMarket) {
        const baseCurrencyAccount = accounts.find(
          (acc: any) => acc.currency === selectedMarket.base_name
        );
        if (baseCurrencyAccount) {
          setSelectedAccount(baseCurrencyAccount.account_id);
        } else {
          setSelectedAccount(accounts[0].account_id);
        }
      }
    }
  }, [accounts, mode, selectedMarket]);
  
  // Place order mutation
  const placeMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest('/api/orders', {
        method: 'POST',
        body: orderData
      });
    },
    onSuccess: () => {
      toast({
        title: "Order placed successfully",
        description: `Your ${mode} order has been submitted`,
        variant: "default"
      });
      
      // Clear form
      setAmount("");
      
      // Refresh orders
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to place order",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
    }
  });
  
  // Calculate order details
  const calculateOrderDetails = () => {
    if (!selectedMarket || !amount) {
      return {
        pricePerUnit: "$0.00",
        totalUnits: "0",
        fee: "$0.00",
        total: "$0.00"
      };
    }
    
    const price = orderType === "LIMIT" ? parseFloat(limitPrice) : parseFloat(selectedMarket.price);
    const amountValue = parseFloat(amount);
    
    // For simplicity, assume 0.5% fee
    const fee = (amountValue * 0.005);
    
    // Calculate total and units based on mode (buy/sell)
    if (mode === "buy") {
      const totalUnits = (amountValue - fee) / price;
      return {
        pricePerUnit: `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalUnits: totalUnits.toLocaleString(undefined, { maximumFractionDigits: 8 }),
        fee: `$${fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        total: `$${amountValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      };
    } else {
      // Selling
      const totalValue = amountValue * price;
      const feeValue = totalValue * 0.005;
      return {
        pricePerUnit: `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalUnits: amountValue.toLocaleString(undefined, { maximumFractionDigits: 8 }),
        fee: `$${feeValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        total: `$${(totalValue - feeValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      };
    }
  };
  
  // Get account available balance
  const getAccountBalance = () => {
    if (!accounts || !selectedAccount) return "0";
    
    const account = accounts.find((acc: any) => acc.account_id === selectedAccount);
    return account ? account.available_balance.value : "0";
  };
  
  // Handle order placement
  const handlePlaceOrder = () => {
    if (!selectedMarket || !amount || !hasKeys) {
      toast({
        title: "Invalid order",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }
    
    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    
    // Validate limit price for limit orders
    if (orderType === "LIMIT" && (isNaN(parseFloat(limitPrice)) || parseFloat(limitPrice) <= 0)) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid limit price",
        variant: "destructive"
      });
      return;
    }
    
    // Build order configuration based on order type
    let orderConfiguration = {};
    if (orderType === "MARKET") {
      orderConfiguration = {
        market_market_ioc: {
          base_size: calculateOrderDetails().totalUnits
        }
      };
    } else if (orderType === "LIMIT") {
      orderConfiguration = {
        limit_limit_gtc: {
          base_size: calculateOrderDetails().totalUnits,
          limit_price: limitPrice,
          post_only: false
        }
      };
    }
    
    // Create order request
    const orderRequest = {
      product_id: selectedMarket.product_id,
      side: mode === "buy" ? OrderSide.BUY : OrderSide.SELL,
      order_configuration: orderConfiguration
    };
    
    // Place order
    placeMutation.mutate(orderRequest);
  };
  
  const orderDetails = calculateOrderDetails();

  return (
    <div className="col-span-12 md:col-span-4 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
      <div className="flex border-b border-[#3A3A3A]">
        <button className="flex-1 py-3 text-center text-[#0052FF] font-medium border-b-2 border-[#0052FF]">
          Trade
        </button>
        <button className="flex-1 py-3 text-center text-gray-400 font-medium hover:text-white">
          Convert
        </button>
      </div>
      
      <div className="p-4">
        <div className="flex rounded-lg overflow-hidden border border-[#3A3A3A] mb-4">
          <button 
            className={`flex-1 py-2 text-center font-medium ${
              mode === 'buy' 
                ? 'text-white bg-[#0052FF]' 
                : 'text-gray-400 bg-card-bg hover:text-white'
            }`}
            onClick={() => setMode('buy')}
          >
            Buy
          </button>
          <button 
            className={`flex-1 py-2 text-center font-medium ${
              mode === 'sell' 
                ? 'text-white bg-[#0052FF]' 
                : 'text-gray-400 bg-card-bg hover:text-white'
            }`}
            onClick={() => setMode('sell')}
          >
            Sell
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Pay with</label>
            <div className="relative">
              <select 
                className="w-full bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF] appearance-none"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                disabled={!hasKeys || isLoadingAccounts}
              >
                {!hasKeys ? (
                  <option value="">Connect API keys first</option>
                ) : isLoadingAccounts ? (
                  <option value="">Loading accounts...</option>
                ) : accounts && accounts.length === 0 ? (
                  <option value="">No accounts available</option>
                ) : accounts ? (
                  accounts.map((account: any) => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.currency} - {parseFloat(account.available_balance.value).toLocaleString()} available
                    </option>
                  ))
                ) : (
                  <option value="">Loading accounts...</option>
                )}
              </select>
              <span className="material-icons absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Amount</label>
            <div className="relative">
              <input 
                type="text" 
                className="w-full bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-2 pl-3 pr-24 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF]" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!hasKeys}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                {mode === 'buy' ? 'USD' : selectedMarket?.base_name || 'BTC'}
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Order Type</label>
            <div className="relative">
              <select 
                className="w-full bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF] appearance-none"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
                disabled={!hasKeys}
              >
                <option value="MARKET">Market Order</option>
                <option value="LIMIT">Limit Order</option>
              </select>
              <span className="material-icons absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
          
          {orderType === 'LIMIT' && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Limit Price</label>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full bg-dark-bg text-white border border-[#3A3A3A] rounded-md py-2 pl-3 pr-16 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052FF]" 
                  placeholder="0.00"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  disabled={!hasKeys}
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                  USD
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-dark-bg rounded-md p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price per {selectedMarket?.base_name || 'BTC'}</span>
              <span className="text-white font-mono">{orderDetails.pricePerUnit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total {selectedMarket?.base_name || 'BTC'}</span>
              <span className="text-white font-mono">{orderDetails.totalUnits}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Coinbase Fee</span>
              <span className="text-white font-mono">{orderDetails.fee}</span>
            </div>
            <div className="border-t border-[#3A3A3A] my-2"></div>
            <div className="flex justify-between text-sm font-medium">
              <span className="text-white">Total</span>
              <span className="text-white font-mono">{orderDetails.total}</span>
            </div>
          </div>
          
          <button 
            className="w-full bg-[#0052FF] text-white font-medium py-2.5 rounded-md hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed"
            onClick={handlePlaceOrder}
            disabled={!hasKeys || placeMutation.isPending || !amount || !selectedMarket}
          >
            {placeMutation.isPending ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              `${mode === 'buy' ? 'Buy' : 'Sell'} ${selectedMarket?.base_name || 'BTC'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
