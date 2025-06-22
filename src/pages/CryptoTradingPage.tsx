import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  display_name: string;
  base_currency_id: string;
  quote_currency_id: string;
  price: string;
  price_24h_change: string;
  volume_24h: string;
  status: string;
}

interface Account {
  uuid: string;
  name: string;
  currency: string;
  balance: {
    amount: string;
    currency: string;
  };
  available_balance: {
    amount: string;
    currency: string;
  };
}

interface Order {
  order_id: string;
  product_id: string;
  side: 'BUY' | 'SELL';
  order_configuration: {
    market_market_ioc?: {
      quote_size?: string;
      base_size?: string;
    };
    limit_limit_gtc?: {
      base_size: string;
      limit_price: string;
    };
  };
  status: string;
  created_time: string;
  completion_percentage: string;
  filled_size: string;
  average_filled_price: string;
}

const CryptoTradingPage: React.FC = () => {
  const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderAmount, setOrderAmount] = useState<string>('');
  const [orderPrice, setOrderPrice] = useState<string>('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
      if (data.length > 0 && !selectedProduct) {
        setSelectedProduct(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch cryptocurrency products');
    }
  };

  // Fetch accounts
  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to fetch account balances');
    }
  };

  // Fetch orders
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch order history');
    }
  };

  // Place order
  const handlePlaceOrder = async () => {
    if (!selectedProduct || !orderAmount) {
      toast.error('Please select a product and enter an amount');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const orderData = {
        client_order_id: `order-${Date.now()}`,
        product_id: selectedProduct,
        side: orderSide,
        order_configuration: orderType === 'market' ? {
          market_market_ioc: {
            [orderSide === 'BUY' ? 'quote_size' : 'base_size']: orderAmount
          }
        } : {
          limit_limit_gtc: {
            base_size: orderAmount,
            limit_price: orderPrice
          }
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) throw new Error('Failed to place order');
      
      toast.success('Order placed successfully!');
      setOrderAmount('');
      setOrderPrice('');
      fetchOrders();
      fetchAccounts();
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to cancel order');
      
      toast.success('Order cancelled successfully!');
      fetchOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchAccounts();
    fetchOrders();
  }, []);

  const selectedProductData = products.find(p => p.id === selectedProduct);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Crypto Trading Platform</h1>
        <div className="flex items-center space-x-2">
          <Badge variant={wsConnected ? "default" : "secondary"}>
            {wsConnected ? "Connected" : "Disconnected"}
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            API Keys
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Market Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {products.slice(0, 4).map((product) => (
                  <div key={product.id} className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold">{product.base_currency_id}</div>
                    <div className="text-2xl font-bold">${parseFloat(product.price || '0').toFixed(2)}</div>
                    <div className={`text-sm flex items-center justify-center ${
                      parseFloat(product.price_24h_change || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {parseFloat(product.price_24h_change || '0') >= 0 ? 
                        <TrendingUp className="h-3 w-3 mr-1" /> : 
                        <TrendingDown className="h-3 w-3 mr-1" />
                      }
                      {parseFloat(product.price_24h_change || '0').toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Order History */}
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.order_id}>
                      <TableCell>{order.product_id}</TableCell>
                      <TableCell>
                        <Badge variant={order.side === 'BUY' ? "default" : "secondary"}>
                          {order.side}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.filled_size || 'N/A'}</TableCell>
                      <TableCell>${order.average_filled_price || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {order.status === 'OPEN' && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleCancelOrder(order.order_id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Place Order */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Place Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cryptocurrency" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Tabs value={orderSide} onValueChange={(value) => setOrderSide(value as 'BUY' | 'SELL')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="BUY">Buy</TabsTrigger>
                  <TabsTrigger value="SELL">Sell</TabsTrigger>
                </TabsList>
              </Tabs>

              <Tabs value={orderType} onValueChange={(value) => setOrderType(value as 'market' | 'limit')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market</TabsTrigger>
                  <TabsTrigger value="limit">Limit</TabsTrigger>
                </TabsList>
              </Tabs>

              <Input
                placeholder="Amount"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                type="number"
                step="0.00000001"
              />

              {orderType === 'limit' && (
                <Input
                  placeholder="Price"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  type="number"
                  step="0.01"
                />
              )}

              {selectedProductData && (
                <div className="text-sm text-muted-foreground">
                  Current Price: ${parseFloat(selectedProductData.price || '0').toFixed(2)}
                </div>
              )}

              <Button 
                onClick={handlePlaceOrder} 
                disabled={loading}
                className="w-full"
                variant={orderSide === 'BUY' ? "default" : "destructive"}
              >
                {loading ? 'Placing...' : `${orderSide} ${selectedProductData?.base_currency_id || 'Crypto'}`}
              </Button>
            </CardContent>
          </Card>

          {/* Account Balances */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="h-5 w-5 mr-2" />
                Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.uuid} className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{account.currency}</div>
                      <div className="text-sm text-muted-foreground">
                        Available: {parseFloat(account.available_balance?.amount || '0').toFixed(8)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {parseFloat(account.balance?.amount || '0').toFixed(8)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CryptoTradingPage;