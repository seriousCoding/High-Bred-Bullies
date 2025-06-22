import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, DollarSign, Activity, Wallet, BarChart3 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Product {
  product_id: string;
  display_name: string;
  base_currency: string;
  quote_currency: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
  status: string;
}

interface Account {
  uuid: string;
  name: string;
  currency: string;
  available_balance: {
    value: string;
    currency: string;
  };
  hold: {
    value: string;
    currency: string;
  };
}

interface Order {
  order_id: string;
  product_id: string;
  side: 'BUY' | 'SELL';
  size: string;
  price: string;
  status: string;
  created_time: string;
  filled_size: string;
}

const TradingDashboard = () => {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string>('BTC-USD');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async (): Promise<Account[]> => {
      const response = await fetch('/api/accounts');
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Order Placed',
        description: 'Your order has been successfully placed',
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setSize('');
      setPrice('');
    },
    onError: (error: any) => {
      toast({
        title: 'Order Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePlaceOrder = () => {
    if (!size || (orderType === 'limit' && !price)) {
      toast({
        title: 'Invalid Order',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const orderData = {
      product_id: selectedProduct,
      side,
      size,
      type: orderType,
      ...(orderType === 'limit' && { price }),
    };

    createOrderMutation.mutate(orderData);
  };

  const selectedProductData = products.find(p => p.product_id === selectedProduct);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Coinbase Advanced Trading</h1>
        <Badge variant="outline" className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Live Market Data
        </Badge>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.slice(0, 4).map((product) => (
          <Card key={product.product_id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedProduct(product.product_id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{product.display_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${parseFloat(product.price).toLocaleString()}</div>
              <div className={`flex items-center text-sm ${
                parseFloat(product.price_percentage_change_24h) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {parseFloat(product.price_percentage_change_24h) >= 0 ? 
                  <TrendingUp className="w-4 h-4 mr-1" /> : 
                  <TrendingDown className="w-4 h-4 mr-1" />
                }
                {parseFloat(product.price_percentage_change_24h).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Place Order
            </CardTitle>
            <CardDescription>
              {selectedProductData?.display_name} - ${selectedProductData?.price}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={side === 'BUY' ? 'default' : 'outline'}
                onClick={() => setSide('BUY')}
                className="bg-green-600 hover:bg-green-700"
              >
                Buy
              </Button>
              <Button 
                variant={side === 'SELL' ? 'default' : 'outline'}
                onClick={() => setSide('SELL')}
                className="bg-red-600 hover:bg-red-700"
              >
                Sell
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={orderType === 'market' ? 'default' : 'outline'}
                onClick={() => setOrderType('market')}
              >
                Market
              </Button>
              <Button 
                variant={orderType === 'limit' ? 'default' : 'outline'}
                onClick={() => setOrderType('limit')}
              >
                Limit
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Size ({selectedProductData?.base_currency})</Label>
              <Input
                id="size"
                type="number"
                step="0.00000001"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="0.00000000"
              />
            </div>

            {orderType === 'limit' && (
              <div className="space-y-2">
                <Label htmlFor="price">Price ({selectedProductData?.quote_currency})</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            <Button 
              onClick={handlePlaceOrder}
              disabled={createOrderMutation.isPending}
              className="w-full"
            >
              {createOrderMutation.isPending ? 'Placing Order...' : 'Place Order'}
            </Button>
          </CardContent>
        </Card>

        {/* Account Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Account Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div>Loading balances...</div>
            ) : (
              <div className="space-y-3">
                {accounts.filter(acc => parseFloat(acc.available_balance.value) > 0).map((account) => (
                  <div key={account.uuid} className="flex justify-between items-center">
                    <span className="font-medium">{account.currency}</span>
                    <div className="text-right">
                      <div className="font-semibold">
                        {parseFloat(account.available_balance.value).toFixed(8)}
                      </div>
                      {parseFloat(account.hold.value) > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Hold: {parseFloat(account.hold.value).toFixed(8)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div>Loading orders...</div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.order_id} className="border rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{order.product_id}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.side} {order.size}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={order.status === 'FILLED' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                        <div className="text-sm text-muted-foreground mt-1">
                          ${parseFloat(order.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Market Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Market Data</CardTitle>
          <CardDescription>Real-time cryptocurrency prices and market data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-right p-2">24h Change</th>
                  <th className="text-right p-2">Volume</th>
                  <th className="text-center p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.product_id} className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedProduct(product.product_id)}>
                    <td className="p-2 font-medium">{product.display_name}</td>
                    <td className="p-2 text-right">${parseFloat(product.price).toLocaleString()}</td>
                    <td className={`p-2 text-right ${
                      parseFloat(product.price_percentage_change_24h) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {parseFloat(product.price_percentage_change_24h).toFixed(2)}%
                    </td>
                    <td className="p-2 text-right">{parseFloat(product.volume_24h).toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <Badge variant={product.status === 'online' ? 'default' : 'secondary'}>
                        {product.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradingDashboard;