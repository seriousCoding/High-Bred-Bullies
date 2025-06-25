import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { APP_NAME, CONTACT_EMAIL } from '@/constants/app';

interface InvoiceViewerProps {
  order: {
    id: string;
    total_amount: number;
    subtotal_amount?: number;
    discount_amount?: number;
    delivery_cost?: number;
    created_at: string;
    delivery_type: string;
    delivery_zip_code?: string;
    stripe_session_id?: string;
  };
  puppies: Array<{
    id: string;
    name: string;
  }>;
  customerInfo?: {
    name: string;
    email: string;
  };
}

export const InvoiceViewer = ({ order, puppies, customerInfo }: InvoiceViewerProps) => {
  const subtotal = order.subtotal_amount || order.total_amount;
  const discount = order.discount_amount || 0;
  const deliveryCost = order.delivery_cost || 0;

  const generateInvoiceContent = () => {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice #${order.id.substring(0, 8)}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-details { margin-bottom: 30px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background-color: #f8f9fa; font-weight: bold; }
        .totals { text-align: right; margin-top: 20px; }
        .total-line { margin-bottom: 8px; }
        .final-total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>INVOICE</h1>
        <h2>${APP_NAME}</h2>
    </div>
    
    <div class="invoice-details">
        <p><strong>Invoice #:</strong> ${order.id.substring(0, 8)}</p>
        <p><strong>Date:</strong> ${format(new Date(order.created_at), 'PPP')}</p>
        <p><strong>Customer:</strong> ${customerInfo?.name || 'Customer'}</p>
        <p><strong>Email:</strong> ${customerInfo?.email || 'N/A'}</p>
        <p><strong>Delivery Type:</strong> ${order.delivery_type === 'delivery' ? 'Local Delivery' : 'Pickup'}</p>
        ${order.delivery_zip_code ? `<p><strong>Delivery ZIP:</strong> ${order.delivery_zip_code}</p>` : ''}
    </div>

    <table class="table">
        <thead>
            <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${puppies.map(puppy => `
                <tr>
                    <td>Puppy Reservation</td>
                    <td>${puppy.name || `Puppy #${puppy.id.substring(0, 4)}`}</td>
                    <td>1</td>
                    <td>$${((subtotal - deliveryCost) / puppies.length / 100).toFixed(2)}</td>
                </tr>
            `).join('')}
            ${deliveryCost > 0 ? `
                <tr>
                    <td>Delivery Fee</td>
                    <td>Local delivery service</td>
                    <td>1</td>
                    <td>$${(deliveryCost / 100).toFixed(2)}</td>
                </tr>
            ` : ''}
        </tbody>
    </table>

    <div class="totals">
        <div class="total-line">Subtotal: $${(subtotal / 100).toFixed(2)}</div>
        ${discount > 0 ? `<div class="total-line">Discount: -$${(discount / 100).toFixed(2)}</div>` : ''}
        <div class="total-line final-total">Total: $${(order.total_amount / 100).toFixed(2)}</div>
    </div>

    <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
        <p>Thank you for your business!</p>
        <p>Questions? Contact us at ${CONTACT_EMAIL}</p>
    </div>
</body>
</html>
    `;
  };

  const handleViewInvoice = () => {
    const invoiceContent = generateInvoiceContent();
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(invoiceContent);
      newWindow.document.close();
    }
  };

  const handleDownloadInvoice = () => {
    const invoiceContent = generateInvoiceContent();
    const blob = new Blob([invoiceContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${order.id.substring(0, 8)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p><strong>Invoice #:</strong> {order.id.substring(0, 8)}</p>
            <p><strong>Date:</strong> {format(new Date(order.created_at), 'PPP')}</p>
            <p><strong>Items:</strong> {puppies.length} puppy(ies)</p>
          </div>
          <div>
            <p><strong>Delivery:</strong> {order.delivery_type === 'delivery' ? 'Local Delivery' : 'Pickup'}</p>
            {order.delivery_zip_code && <p><strong>ZIP:</strong> {order.delivery_zip_code}</p>}
            <p><strong>Total:</strong> ${(order.total_amount / 100).toFixed(2)}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleViewInvoice} className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View Invoice
          </Button>
          <Button onClick={handleDownloadInvoice} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Invoice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
