import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useMarkets } from "@/context/MarketsContext";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";

export default function Portfolio() {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { apiKey, apiSecret, hasKeys } = useApiKeys();
  const { markets } = useMarkets();
  const [timeRange, setTimeRange] = useState("1W");
  
  // Fetch account data
  const { data: accounts, isLoading } = useQuery({
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
  
  // Process account data to display format
  const processAccountData = () => {
    if (!accounts || !Array.isArray(accounts) || !markets.length) {
      return {
        portfolioItems: [],
        totalValue: 0,
        pieChartData: [],
        historyData: [] 
      };
    }
    
    const portfolioItems = accounts
      .filter(account => 
        parseFloat(account.available_balance.value) > 0 || 
        parseFloat(account.hold.value) > 0
      )
      .map(account => {
        // Find market data for this currency if available
        const marketData = markets.find(m => 
          m.base_name === account.currency && m.quote_name === 'USD'
        );
        
        const price = marketData 
          ? parseFloat(marketData.price) 
          : account.currency === 'USD' ? 1 : 0;
        
        const availableBalance = parseFloat(account.available_balance.value);
        const holdBalance = parseFloat(account.hold.value);
        const totalBalance = availableBalance + holdBalance;
        const totalValue = totalBalance * price;
        
        return {
          id: account.account_id,
          currency: account.currency,
          name: getCurrencyName(account.currency),
          available: availableBalance,
          hold: holdBalance,
          total: totalBalance,
          price,
          value: totalValue,
          change: marketData ? parseFloat(marketData.price_percentage_change_24h) : 0
        };
      })
      .sort((a, b) => b.value - a.value);
    
    const totalValue = portfolioItems.reduce((sum, item) => sum + item.value, 0);
    
    // Prepare pie chart data - showing top 5 assets and "Other"
    let pieChartData = [];
    if (portfolioItems.length > 5) {
      const top5 = portfolioItems.slice(0, 5);
      const others = portfolioItems.slice(5);
      const othersValue = others.reduce((sum, item) => sum + item.value, 0);
      
      pieChartData = [
        ...top5.map(item => ({
          name: item.currency,
          value: item.value
        })),
        {
          name: 'Others',
          value: othersValue
        }
      ];
    } else {
      pieChartData = portfolioItems.map(item => ({
        name: item.currency,
        value: item.value
      }));
    }
    
    // Generate mock historical data for chart
    // In a real app, this would come from an API endpoint
    const historyData = generateHistoricalData(timeRange);
    
    return {
      portfolioItems,
      totalValue,
      pieChartData,
      historyData
    };
  };
  
  // Mock function to get currency name
  const getCurrencyName = (currency: string): string => {
    const names: Record<string, string> = {
      BTC: "Bitcoin",
      ETH: "Ethereum",
      SOL: "Solana",
      USDC: "USD Coin",
      USD: "US Dollar",
      ADA: "Cardano",
      DOT: "Polkadot",
      XRP: "Ripple",
      DOGE: "Dogecoin",
      AVAX: "Avalanche"
    };
    return names[currency] || currency;
  };
  
  // Generate mock historical data
  const generateHistoricalData = (range: string) => {
    const data = [];
    const now = new Date();
    let dataPoints = 0;
    let timeStep = 0;
    
    switch (range) {
      case "1D":
        dataPoints = 24;
        timeStep = 60 * 60 * 1000; // 1 hour
        break;
      case "1W":
        dataPoints = 7;
        timeStep = 24 * 60 * 60 * 1000; // 1 day
        break;
      case "1M":
        dataPoints = 30;
        timeStep = 24 * 60 * 60 * 1000; // 1 day
        break;
      case "1Y":
        dataPoints = 12;
        timeStep = 30 * 24 * 60 * 60 * 1000; // 1 month
        break;
      default:
        dataPoints = 7;
        timeStep = 24 * 60 * 60 * 1000; // 1 day
    }
    
    // Start with a base value and modify it slightly for each data point
    let lastValue = 100000;
    
    for (let i = dataPoints; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * timeStep));
      
      // Small random change for each point
      const change = (Math.random() * 0.05) - 0.025; // Between -2.5% and +2.5%
      lastValue = lastValue * (1 + change);
      
      data.push({
        time: time.toISOString(),
        value: lastValue
      });
    }
    
    return data;
  };
  
  const COLORS = ['#0052FF', '#05B169', '#FF3B30', '#FF9500', '#5856D6', '#34C759'];
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    switch (timeRange) {
      case "1D":
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case "1W":
        return date.toLocaleDateString([], { weekday: 'short' });
      case "1M":
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case "1Y":
        return date.toLocaleDateString([], { month: 'short' });
      default:
        return date.toLocaleDateString();
    }
  };
  
  const { portfolioItems, totalValue, pieChartData, historyData } = processAccountData();
  
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onApiKeyModalOpen={() => setIsApiKeyModalOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-4 p-4">
            {/* Portfolio Value */}
            <div className="col-span-12 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
                <h2 className="text-white font-medium">Portfolio Value</h2>
                <div className="flex space-x-1">
                  {['1D', '1W', '1M', '1Y'].map(range => (
                    <button
                      key={range}
                      className={`px-2 py-1 text-xs rounded ${
                        timeRange === range
                          ? 'bg-[#0052FF] bg-opacity-10 text-[#0052FF]'
                          : 'text-gray-400 hover:bg-gray-700'
                      }`}
                      onClick={() => setTimeRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-4">
                {!hasKeys && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <span className="material-icons text-3xl mb-2">account_balance_wallet</span>
                    <p className="text-sm">Connect API keys to view your portfolio value</p>
                  </div>
                )}
                
                {hasKeys && isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0052FF]"></div>
                  </div>
                )}
                
                {hasKeys && !isLoading && (
                  <>
                    <div className="mb-4">
                      <div className="text-sm text-gray-400">Total Balance (USD)</div>
                      <div className="text-3xl font-medium font-mono text-white">
                        {formatCurrency(totalValue)}
                      </div>
                      <div className="text-sm font-medium text-[#05B169]">
                        {/* In a real app, this would show the portfolio change over the selected time period */}
                        +5.2% for this period
                      </div>
                    </div>
                    
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0052FF" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#0052FF" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={formatDate} 
                            tick={{ fill: '#9CA3AF' }}
                          />
                          <YAxis 
                            tickFormatter={(value) => formatCurrency(value)}
                            tick={{ fill: '#9CA3AF' }}
                            width={80}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), 'Value']}
                            labelFormatter={(label) => formatDate(label)}
                            contentStyle={{ 
                              backgroundColor: '#2A2A2A', 
                              borderColor: '#3A3A3A',
                              color: 'white'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#0052FF" 
                            fillOpacity={1}
                            fill="url(#colorValue)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Portfolio Allocation */}
            <div className="col-span-12 md:col-span-4 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-3 border-b border-[#3A3A3A]">
                <h2 className="text-white font-medium">Portfolio Allocation</h2>
              </div>
              
              <div className="p-4">
                {!hasKeys && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <span className="material-icons text-3xl mb-2">pie_chart</span>
                    <p className="text-sm">Connect API keys to view allocation</p>
                  </div>
                )}
                
                {hasKeys && isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0052FF]"></div>
                  </div>
                )}
                
                {hasKeys && !isLoading && pieChartData.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <span className="material-icons text-3xl mb-2">pie_chart</span>
                    <p className="text-sm">No assets found in your portfolio</p>
                  </div>
                )}
                
                {hasKeys && !isLoading && pieChartData.length > 0 && (
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Value']}
                          contentStyle={{ 
                            backgroundColor: '#2A2A2A', 
                            borderColor: '#3A3A3A',
                            color: 'white'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
            
            {/* Asset List */}
            <div className="col-span-12 md:col-span-8 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-3 border-b border-[#3A3A3A]">
                <h2 className="text-white font-medium">Your Assets</h2>
              </div>
              
              <div className="overflow-x-auto">
                {!hasKeys && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <span className="material-icons text-3xl mb-2">account_balance_wallet</span>
                    <p className="text-sm">Connect API keys to view your assets</p>
                  </div>
                )}
                
                {hasKeys && isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0052FF]"></div>
                  </div>
                )}
                
                {hasKeys && !isLoading && portfolioItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <span className="material-icons text-3xl mb-2">account_balance_wallet</span>
                    <p className="text-sm">No assets found in your portfolio</p>
                  </div>
                )}
                
                {hasKeys && !isLoading && portfolioItems.length > 0 && (
                  <table className="min-w-full divide-y divide-[#3A3A3A]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Asset</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3A3A3A]">
                      {portfolioItems.map((item) => (
                        <tr key={item.id} className="hover:bg-dark-bg">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-7 h-7 rounded-full bg-[#0052FF] bg-opacity-20 flex items-center justify-center mr-2">
                                <span className="text-xs font-medium text-[#0052FF]">{item.currency}</span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">{item.name}</div>
                                <div className="text-xs text-gray-400">{item.currency}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm font-mono text-white">
                              {item.total.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                            </div>
                            {item.hold > 0 && (
                              <div className="text-xs text-gray-400">
                                {item.hold.toLocaleString(undefined, { maximumFractionDigits: 8 })} on hold
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm font-mono text-white">
                              {item.price > 0 ? formatCurrency(item.price) : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm font-mono text-white">
                              {formatCurrency(item.value)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {(item.value / totalValue * 100).toFixed(2)}% of portfolio
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {item.change !== 0 ? (
                              <div className={`text-sm font-medium ${
                                item.change >= 0 ? 'text-[#05B169]' : 'text-[#FF3B30]'
                              }`}>
                                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">—</div>
                            )}
                          </td>
                        </tr>
                      ))}
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
