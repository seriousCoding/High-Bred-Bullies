
import React from 'react';
import { useQuery } from '@tanstack/react-query';
const API_BASE_URL = window.location.origin;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Archive } from 'lucide-react';

interface ArchivedOrder {
  id: string;
  status: string;
  total_amount: number;
  delivery_type: string;
  created_at: string;
  updated_at: string; // This is the archival date
  customer_name: string;
  puppy_names: string;
  puppy_count: number;
}

const fetchArchivedOrders = async () => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/api/orders/archived`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch archived orders');
  return await response.json();
};

export const ArchivedOrders = () => {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['adminArchivedOrders'],
    queryFn: fetchArchivedOrders,
  });

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
        <AlertTitle>Error Fetching Archived Orders</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Archive className="mr-2 h-6 w-6" />
          Archived Orders
        </CardTitle>
        <CardDescription>View past orders that have been cancelled and archived. These are automatically deleted after 30 days.</CardDescription>
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
                <TableHead>Archived Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.id.substring(0,8)}...</TableCell>
                  <TableCell>{order.customer_name || 'N/A'}</TableCell>
                  <TableCell>{order.puppy_names || 'N/A'} ({order.puppy_count})</TableCell>
                  <TableCell>${(order.total_amount / 100).toFixed(2)}</TableCell>
                  <TableCell>{order.status}</TableCell>
                  <TableCell>{new Date(order.updated_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground">No archived orders found.</p>
        )}
      </CardContent>
    </Card>
  );
};
