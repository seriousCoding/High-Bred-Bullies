import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMarkets } from "@/context/MarketsContext";
import { useApiKeys } from "@/hooks/use-api-keys";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";

type TimeRange = "1H" | "1D" | "1W" | "1M" | "ALL";

type CandleData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const granularityMap: Record<TimeRange, string> = {
  "1H": "ONE_MINUTE",
  "1D": "FIFTEEN_MINUTE",
  "1W": "ONE_HOUR",
  "1M": "SIX_HOUR",
  "ALL": "ONE_DAY",
};

const getTimeRangeParams = (range: TimeRange): { start: string; end: string } => {
  const end = new Date();
  let start = new Date();
  
  switch (range) {
    case "1H":
      start.setHours(end.getHours() - 1);
      break;
    case "1D":
      start.setDate(end.getDate() - 1);
      break;
    case "1W":
      start.setDate(end.getDate() - 7);
      break;
    case "1M":
      start.setMonth(end.getMonth() - 1);
      break;
    case "ALL":
      start.setFullYear(end.getFullYear() - 1);
      break;
  }
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export function PriceChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1D");
  const { selectedMarket } = useMarkets();
  const { apiKey, apiSecret } = useApiKeys();
  
  const { data: candles, isLoading, error } = useQuery({
    queryKey: [
      `/api/products/${selectedMarket?.product_id}/candles`, 
      selectedMarket?.product_id,
      timeRange
    ],
    enabled: !!selectedMarket && !!apiKey && !!apiSecret,
    queryFn: async ({ queryKey }) => {
      const [_, productId, range] = queryKey;
      const { start, end } = getTimeRangeParams(range as TimeRange);
      const granularity = granularityMap[range as TimeRange];
      
      const res = await fetch(
        `/api/products/${productId}/candles?start=${start}&end=${end}&granularity=${granularity}`,
        {
          headers: {
            'x-api-key': apiKey!, 
            'x-api-secret': apiSecret!
          }
        }
      );
      
      if (!res.ok) {
        throw new Error('Failed to fetch candle data');
      }
      
      return res.json();
    },
    refetchInterval: 10000, // Refresh data every 10 seconds
  });
  
  const formattedData = candles ? candles.map((candle: any) => ({
    time: new Date(candle.start).getTime(),
    price: parseFloat(candle.close),
    open: parseFloat(candle.open),
    high: parseFloat(candle.high),
    low: parseFloat(candle.low),
    volume: parseFloat(candle.volume),
  })).sort((a: any, b: any) => a.time - b.time) : [];

  const formatDate = (time: number) => {
    const date = new Date(time);
    
    switch (timeRange) {
      case "1H":
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case "1D":
        return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      case "1W":
        return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
      case "1M":
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case "ALL":
        return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleDateString();
    }
  };

  const formatPrice = (price: number) => {
    return parseFloat(price.toFixed(2)).toLocaleString();
  };

  const chartColor = formattedData.length > 1 && 
    formattedData[formattedData.length - 1].price > formattedData[0].price
    ? "#05B169" : "#FF3B30";

  return (
    <div className="col-span-12 lg:col-span-8 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
      <div className="flex items-center justify-between p-3 border-b border-[#3A3A3A]">
        <div className="flex items-center space-x-2">
          <h2 className="text-white font-medium">Price Chart</h2>
          <span className="text-xs text-gray-400">
            {selectedMarket?.product_id || "Select a market"}
          </span>
        </div>
        <div className="flex space-x-1">
          {(['1H', '1D', '1W', '1M', 'ALL'] as TimeRange[]).map(range => (
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
      
      <div className="chart-container">
        {isLoading && (
          <div className="h-full w-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0052FF]"></div>
          </div>
        )}
        
        {error && (
          <div className="h-full w-full flex items-center justify-center text-red-500">
            <span className="material-icons mr-2">error</span>
            Failed to load chart data
          </div>
        )}
        
        {!isLoading && !error && formattedData.length === 0 && (
          <div className="h-full w-full flex items-center justify-center text-gray-500">
            No data available for the selected time range
          </div>
        )}
        
        {!isLoading && !error && formattedData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
              <XAxis 
                dataKey="time" 
                tickFormatter={formatDate} 
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={formatPrice}
                tick={{ fill: '#9CA3AF' }}
                width={80}
              />
              <Tooltip 
                formatter={(value: number) => ['$' + formatPrice(value), 'Price']}
                labelFormatter={(label) => formatDate(label)}
                contentStyle={{ 
                  backgroundColor: '#2A2A2A', 
                  borderColor: '#3A3A3A',
                  color: 'white'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke={chartColor} 
                dot={false} 
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
