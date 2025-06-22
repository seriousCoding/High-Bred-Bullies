import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { OrderDetailsDialog } from './OrderDetailsDialog';

interface Order {
  id: string;
  status: string;
  total_amount: number;
  delivery_type: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  puppy_names: string;
  puppy_count: number;
  order_items: any[];
}

const fetchOrderDetails = async (orderId: string) => {
  // Get the complete order data with all Stripe information
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  // Get user profile data with detailed information
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, phone, address, city, state, zip_code, user_id')
    .eq('user_id', orderData.user_id)
    .single();

  if (profileError) {
    console.warn('Profile not found for user:', orderData.user_id);
  }

  // Get the user's actual email using the RPC function
  let userEmail = 'Email not available';
  
  try {
    const { data: emailData, error: emailError } = await supabase.rpc('get_user_email', {
      user_uuid: orderData.user_id
    });
    
    if (!emailError && emailData) {
      userEmail = emailData;
    }
  } catch (error) {
    console.warn('Could not fetch user email:', error);
  }

  // Get order items with complete puppy details and actual prices
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select(`
      price,
      puppy_id,
      puppies(
        id, 
        name, 
        gender, 
        color, 
        litters(name)
      )
    `)
    .eq('order_id', orderId);

  if (itemsError) throw itemsError;

  return {
    ...orderData,
    customer_name: profileData ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() : 'Unknown Customer',
    customer_email: userEmail,
    customer_phone: profileData?.phone || '',
    customer_address: profileData?.address || '',
    customer_city: profileData?.city || '',
    customer_state: profileData?.state || '',
    customer_zip_code: profileData?.zip_code || '',
    user_email: userEmail,
    order_items: orderItems?.map((item: any) => ({
      puppy_id: item.puppy_id,
      puppy_name: item.puppies?.name || 'Unnamed',
      puppy_gender: item.puppies?.gender || 'Unknown',
      puppy_color: item.puppies?.color || 'Unknown',
      litter_name: item.puppies?.litters?.name || 'Unknown Litter',
      price: item.price || 0
    })) || []
  };
};

const fetchOrders = async () => {
  const { data, error } = await supabase.rpc('get_admin_orders');

  if (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
  return data as unknown as Order[];
};

const cancelOrder = async ({ order_id, token }: { order_id: string, token: string }) => {
  const { data, error } = await supabase.functions.invoke('cancel-order', {
    body: { order_id },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  return data;
};

export const AdminOrders = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['adminOrders'],
    queryFn: fetchOrders,
  });

  const { data: selectedOrderDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['orderDetails', selectedOrderId],
    queryFn: () => selectedOrderId ? fetchOrderDetails(selectedOrderId) : null,
    enabled: !!selectedOrderId,
  });

  const { mutate: cancelOrderMutation, isPending: isCancelling } = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      toast.success("Order has been cancelled. Puppies are available again.");
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminArchivedOrders'] });
    },
    onError: (e: any) => {
      toast.error(`Failed to cancel order: ${e.message}`);
    }
  });

  const handleCancelOrder = (orderId: string) => {
    if (!session) {
      toast.error("You must be logged in to perform this action.");
      return;
    }
    if (window.confirm("Are you sure you want to cancel this order? This will make the puppy/puppies available for purchase again. This action cannot be undone.")) {
      cancelOrderMutation({ order_id: orderId, token: session.access_token });
    }
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setOrderDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Fetching Orders</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Manage Orders</CardTitle>
          <CardDescription>View and manage customer orders with complete details.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Puppies</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs break-all">{order.id}</TableCell>
                    <TableCell>{order.customer_name || 'N/A'}</TableCell>
                    <TableCell>{order.puppy_names || 'N/A'} ({order.puppy_count})</TableCell>
                    <TableCell>${(order.total_amount / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' || order.status === 'archived' ? 'bg-red-100 text-red-800' :
                        order.status === 'paid' || order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewOrder(order.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        {order.status.toLowerCase() !== 'cancelled' && order.status.toLowerCase() !== 'archived' ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={isCancelling}
                          >
                            {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-2" />Cancel</>}
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">{order.status}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground">No orders found.</p>
          )}
        </CardContent>
      </Card>

      {selectedOrderDetails && (
        <OrderDetailsDialog
          order={selectedOrderDetails}
          open={orderDetailsOpen}
          onOpenChange={(open) => {
            setOrderDetailsOpen(open);
            if (!open) {
              setSelectedOrderId(null);
            }
          }}
        />
      )}
    </>
  );
};
