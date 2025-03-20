import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useWebSocket } from "@/hooks/use-websocket";

type Balance = {
  currency: string;
  name: string;
  amount: string;
  value: string;
  change: string;
  icon: string;
};

export function AccountOverview() {
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { subscribe, messages, status } = useWebSocket();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Fetch account balances
  const { data: accounts, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/accounts', refreshTrigger],
    enabled: hasKeys,
    queryFn: async () => {
      const res = await fetch('/api/accounts', {
        headers: {
          'x-api-key': apiKey!,
          'x-api-secret': apiSecret!
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch account data');
      }
      
      return res.json();
    }
  });
  
  // Subscribe to account updates via WebSocket
  useEffect(() => {
    if (!hasKeys) return;
    
    // Note: We've temporarily disabled the user channel subscription
    // until we resolve authentication issues with the WebSocket API
    // Once fixed, we'll re-enable this to get real-time account updates
    /*
    subscribe({
      type: "subscribe",
      channel: "user"
    });
    */
    
    // We're also not unsubscribing since we're not subscribing in the first place
    return () => {
      // This is temporarily commented out until we resolve authentication issues
      /*
      subscribe({
        type: "unsubscribe",
        channel: "user"
      });
      */
    };
  }, [hasKeys]);
  
  // Process WebSocket messages
  useEffect(() => {
    if (!messages.length) return;
    
    // Look for account update messages
    const accountUpdates = messages.filter(msg => 
      msg.channel === "user" && 
      msg.events && 
      msg.events.length > 0 &&
      msg.events[0].accounts
    );
    
    if (accountUpdates.length > 0) {
      // Refresh account data when we receive updates
      refetch();
    }
  }, [messages]);
  
  // Convert account data to display format
  const formatAccountData = (): {
    totalBalance: string;
    balances: Balance[];
  } => {
    if (!accounts || !Array.isArray(accounts)) {
      return { totalBalance: "$0.00", balances: [] };
    }
    
    // Default icon colors by currency
    const currencyColors: Record<string, string> = {
      BTC: "bg-[#0052FF]",
      ETH: "bg-gray-600",
      SOL: "bg-gray-600",
      USD: "bg-green-600",
    };
    
    const balances: Balance[] = accounts
      .filter(account => 
        parseFloat(account.available_balance.value) > 0 || 
        parseFloat(account.hold.value) > 0
      )
      .map(account => ({
        currency: account.currency,
        name: getCurrencyName(account.currency),
        amount: account.available_balance.value,
        value: "$" + (parseFloat(account.available_balance.value) * getCurrencyPrice(account.currency)).toFixed(2),
        change: getPriceChange(account.currency), // This should come from real price data
        icon: currencyColors[account.currency] || "bg-gray-600"
      }))
      .sort((a, b) => parseFloat(b.value.substring(1)) - parseFloat(a.value.substring(1)));
    
    // Calculate total balance
    const totalValue = balances.reduce((sum, balance) => sum + parseFloat(balance.value.substring(1)), 0);
    
    return {
      totalBalance: "$" + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      balances
    };
  };
  
  // Get currency name from currency code
  const getCurrencyName = (currency: string): string => {
    // Common cryptocurrency names
    const names: Record<string, string> = {
      BTC: "Bitcoin",
      ETH: "Ethereum",
      SOL: "Solana",
      USDC: "USD Coin",
      USD: "US Dollar"
    };
    return names[currency] || currency;
  };
  
  // Function to get currency price - in a real implementation this should use real market data
  const getCurrencyPrice = (currency: string): number => {
    // For now, we'll use 1:1 for USD and USDC as they're stablecoins
    if (currency === 'USD' || currency === 'USDC') {
      return 1;
    }
    // For other currencies, we should ideally fetch this from the API
    // but for now return 0 to avoid showing incorrect values
    return 0;
  };
  
  // Get price change percentage - should come from API in real implementation
  const getPriceChange = (currency: string): string => {
    return "0.00%";  // Default to 0% change until we have real data
  };
  
  const { totalBalance, balances } = formatAccountData();

  return (
    <div className="col-span-12 md:col-span-4 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
      <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
        <h2 className="text-white font-medium">Account Balance</h2>
        <button 
          className="text-[#0052FF] hover:text-blue-400"
          onClick={() => setRefreshTrigger(prev => prev + 1)}
        >
          <span className="material-icons text-base">refresh</span>
        </button>
      </div>
      
      <div className="p-4">
        {!hasKeys && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <span className="material-icons text-3xl mb-2">account_balance_wallet</span>
            <p className="text-sm">Connect API keys to view account balances</p>
          </div>
        )}
        
        {hasKeys && isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0052FF]"></div>
          </div>
        )}
        
        {hasKeys && error && (
          <div className="flex items-center justify-center py-8 text-[#FF3B30]">
            <span className="material-icons mr-2">error</span>
            Failed to load account data
          </div>
        )}
        
        {hasKeys && !isLoading && !error && (
          <>
            <div className="mb-4">
              <div className="text-sm text-gray-400">Total Balance (USD)</div>
              <div className="text-2xl font-medium font-mono text-white">{totalBalance}</div>
              {/* This should be updated with real daily performance data */}
              <div className="text-xs font-medium">0.00% today</div>
            </div>
            
            <div className="space-y-3">
              {balances.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  No balances found
                </div>
              ) : (
                balances.map((balance, index) => (
                  <div key={balance.currency} className={`flex items-center justify-between py-2 ${
                    index < balances.length - 1 ? "border-b border-[#3A3A3A]" : ""
                  }`}>
                    <div className="flex items-center">
                      <div className={`w-7 h-7 rounded-full ${balance.icon} bg-opacity-20 flex items-center justify-center mr-2`}>
                        <span className="text-xs font-medium text-[#0052FF]">{balance.currency}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{balance.name}</div>
                        <div className="text-xs text-gray-400">{parseFloat(balance.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {balance.currency}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium font-mono">{balance.value}</div>
                      <div className={`text-xs font-medium ${
                        balance.change.startsWith('+') ? 'text-[#05B169]' : 'text-[#FF3B30]'
                      }`}>
                        {balance.change}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
