import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
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
  const token = localStorage.getItem('token');
  
  // Get the complete order data with all Stripe information
  const orderResponse = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!orderResponse.ok) {
    throw new Error(`Failed to fetch order: ${orderResponse.statusText}`);
  }

  const orderData = await orderResponse.json();

  // Get user profile data with detailed information
  let profileData = null;
  try {
    const profileResponse = await fetch(`${API_BASE_URL}/api/user-profiles/${orderData.user_id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (profileResponse.ok) {
      profileData = await profileResponse.json();
    }
  } catch (error) {
    console.warn('Profile not found for user:', orderData.user_id);
  }

  // Get the user's actual email
  let userEmail = 'Email not available';
  
  try {
    const emailResponse = await fetch(`${API_BASE_URL}/api/users/${orderData.user_id}/email`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      userEmail = emailData.email;
    }
  } catch (error) {
    console.warn('Could not fetch user email:', error);
  }

  // Get order items with complete puppy details and actual prices
  const itemsResponse = await fetch(`${API_BASE_URL}/api/orders/${orderId}/items`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!itemsResponse.ok) {
    throw new Error(`Failed to fetch order items: ${itemsResponse.statusText}`);
  }

  const orderItems = await itemsResponse.json();

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
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/admin/orders`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.statusText}`);
  }

  const data = await response.json();
  return data as unknown as Order[];
};

const cancelOrder = async ({ order_id, token }: { order_id: string, token: string }) => {
  const response = await fetch(`${API_BASE_URL}/api/orders/${order_id}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel order: ${response.statusText}`);
  }

  return await response.json();
};

export const AdminOrders = () => {
  const { user } = useAuth();
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
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error("You must be logged in to perform this action.");
      return;
    }
    if (window.confirm("Are you sure you want to cancel this order? This will make the puppy/puppies available for purchase again. This action cannot be undone.")) {
      cancelOrderMutation({ order_id: orderId, token });
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
