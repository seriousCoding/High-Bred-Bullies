
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoiceViewer } from '@/components/InvoiceViewer';
import { Loader2, Package } from 'lucide-react';
import { format } from 'date-fns';

const OrderHistory = () => {
  const { user } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['user-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/orders?user_id=${user.id}&status=paid`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      return await response.json();
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No orders found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Order History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {orders.map((order) => {
          const puppies = order.order_items?.map((item: any) => ({
            id: item.puppies?.id || item.puppy_id,
            name: item.puppies?.name || 'Puppy'
          })) || [];

          return (
            <div key={order.id} className="border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium">Order #{order.id.substring(0, 8)}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(order.created_at), 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="font-medium">${(order.total_amount / 100).toFixed(2)}</p>
                  <p className="text-muted-foreground">
                    {puppies.length} puppy(ies)
                  </p>
                </div>
                <div>
                  <p className="font-medium">
                    {order.delivery_type === 'delivery' ? 'Delivery' : 'Pickup'}
                  </p>
                  <p className="text-muted-foreground">
                    Status: {order.status}
                  </p>
                </div>
              </div>
              
              <InvoiceViewer 
                order={order}
                puppies={puppies}
                customerInfo={{
                  name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Customer',
                  email: user?.email || ''
                }}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default OrderHistory;
