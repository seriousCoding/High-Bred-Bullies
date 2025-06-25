import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface OrderItem {
  puppy_id: string;
  puppy_name: string;
  puppy_gender: string;
  puppy_color: string;
  litter_name: string;
  price: number;
}

interface OrderDetails {
  id: string;
  status: string;
  total_amount: number;
  delivery_type: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_zip_code?: string;
  order_items: OrderItem[];
  delivery_cost?: number;
  subtotal_amount?: number;
  discount_amount?: number;
  notes?: string;
  delivery_address?: string;
  delivery_zip_code?: string;
  scheduled_date?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  user_email?: string;
}

interface OrderDetailsDialogProps {
  order: OrderDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  order,
  open,
  onOpenChange
}) => {
  // Calculate fallback price based on typical pricing if order item price is 0
  const getDisplayPrice = (item: OrderItem) => {
    if (item.price > 0) {
      return item.price;
    }
    // Fallback pricing: $500 for males, $600 for females (typical puppy pricing)
    return item.puppy_gender === 'male' ? 50000 : 60000; // prices in cents
  };

  const formatPrice = (priceInCents: number) => {
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'archived':
        return 'bg-red-100 text-red-800';
      case 'paid':
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Order Details
            <Badge className={getStatusColor(order.status)}>
              {order.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Complete order information including customer details and payment information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Order Information</h3>
              <p><strong>Order ID:</strong> <span className="font-mono text-sm break-all">{order.id}</span></p>
              <p><strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
              <p><strong>Delivery Type:</strong> {order.delivery_type}</p>
              {order.scheduled_date && (
                <p><strong>Scheduled Date:</strong> {new Date(order.scheduled_date).toLocaleDateString()}</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Customer Information</h3>
              <p><strong>Name:</strong> {order.customer_name}</p>
              <p><strong>Email:</strong> <span className="break-all">{order.customer_email}</span></p>
              {order.customer_phone && (
                <p><strong>Phone:</strong> {order.customer_phone}</p>
              )}
            </div>
          </div>

          {/* Stripe Payment Information */}
          {(order.stripe_session_id || order.stripe_payment_intent_id) && (
            <div>
              <h3 className="font-semibold mb-2">Stripe Payment Information</h3>
              <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                {order.stripe_session_id && (
                  <div>
                    <p><strong>Session ID:</strong></p>
                    <span className="font-mono text-sm break-all bg-white px-2 py-1 rounded border">
                      {order.stripe_session_id}
                    </span>
                  </div>
                )}
                {order.stripe_payment_intent_id && (
                  <div>
                    <p><strong>Payment Intent ID:</strong></p>
                    <span className="font-mono text-sm break-all bg-white px-2 py-1 rounded border">
                      {order.stripe_payment_intent_id}
                    </span>
                  </div>
                )}
                <p><strong>Payment Status:</strong> 
                  <Badge variant="outline" className="ml-2">
                    {order.status === 'paid' || order.status === 'completed' ? 'Paid' : 'Pending'}
                  </Badge>
                </p>
              </div>
            </div>
          )}

          {/* Customer Profile Details */}
          {(order.customer_address || order.customer_city || order.customer_state || order.customer_zip_code) && (
            <div>
              <h3 className="font-semibold mb-2">Customer Profile Details</h3>
              <div className="bg-muted p-3 rounded-lg">
                {order.customer_address && (
                  <p><strong>Address:</strong> {order.customer_address}</p>
                )}
                {(order.customer_city || order.customer_state || order.customer_zip_code) && (
                  <p><strong>Location:</strong> 
                    {[order.customer_city, order.customer_state, order.customer_zip_code]
                      .filter(Boolean)
                      .join(', ')
                    }
                  </p>
                )}
              </div>
            </div>
          )}

          {order.delivery_address && (
            <div>
              <h3 className="font-semibold mb-2">Delivery Information</h3>
              <p><strong>Address:</strong> {order.delivery_address}</p>
              {order.delivery_zip_code && (
                <p><strong>Zip Code:</strong> {order.delivery_zip_code}</p>
              )}
            </div>
          )}

          <Separator />

          {/* Order Items */}
          <div>
            <h3 className="font-semibold mb-3">Order Items</h3>
            <div className="space-y-3">
              {order.order_items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{item.puppy_name || 'Unnamed Puppy'}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.litter_name} • {item.puppy_gender} • {item.puppy_color}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(getDisplayPrice(item))}</p>
                    {item.price === 0 && (
                      <p className="text-xs text-orange-600">*Estimated price</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Order Summary */}
          <div className="space-y-2">
            <h3 className="font-semibold mb-3">Order Summary</h3>
            {order.subtotal_amount && (
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatPrice(order.subtotal_amount)}</span>
              </div>
            )}
            {order.delivery_cost && order.delivery_cost > 0 && (
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span>{formatPrice(order.delivery_cost)}</span>
              </div>
            )}
            {order.discount_amount && order.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span>-{formatPrice(order.discount_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>{formatPrice(order.total_amount)}</span>
            </div>
          </div>

          {order.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
