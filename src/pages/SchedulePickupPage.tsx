import React, { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Loader2, CheckCircle, AlertTriangle, Calendar as CalendarIcon, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { addDays, format, isAfter, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { InvoiceViewer } from '@/components/InvoiceViewer';

const finalizeOrder = async ({ session_id, token }: { session_id: string, token: string }) => {
  const response = await fetch(`${API_BASE_URL}/api/orders/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ session_id })
  });

  if (!response.ok) {
    throw new Error('Failed to finalize order');
  }

  return await response.json();
};

const updateScheduledDate = async ({ orderId, scheduledDate }: { orderId: string, scheduledDate: Date }) => {
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/schedule`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
            scheduled_date: scheduledDate.toISOString(),
            scheduling_confirmed_by_user: true
        })
    });

    if (!response.ok) {
        throw new Error("Failed to schedule. Order not found or permission denied.");
    }
    
    return await response.json();
}

const sendConfirmationEmail = async ({ order, userEmail, puppies }: { order: any, userEmail: string, puppies: any[] }) => {
  const response = await fetch(`${API_BASE_URL}/api/email/pickup-confirmation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    },
    body: JSON.stringify({ order, userEmail, puppies })
  });

  if (!response.ok) {
    throw new Error('Failed to send confirmation email');
  }

  return await response.json();
}

const SchedulePickupPage = () => {
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const session_id = searchParams.get('session_id');

  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [orderInfo, setOrderInfo] = useState<any>(null);

  const { mutate: finalize, isPending: isFinalizing, isSuccess, error } = useMutation({
      mutationFn: finalizeOrder,
      onSuccess: (data) => {
        setOrderInfo(data);
        // Invalidate queries that depend on order data to refetch
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        if (data?.litterId) {
          queryClient.invalidateQueries({ queryKey: ['litterDetail', data.litterId] });
        }
      }
  });

  useEffect(() => {
    if (session_id && user && session && !orderInfo && !isFinalizing && !error) {
      finalize({ session_id, token: session.access_token });
    }
  }, [session_id, user, session, finalize, orderInfo, isFinalizing, error]);

  const { mutate: sendEmail, isPending: isSendingEmail } = useMutation({
      mutationFn: sendConfirmationEmail,
      onSuccess: () => {
          toast.success("Confirmation email sent!");
      },
      onError: (e: any) => {
          toast.error(`Failed to send confirmation email: ${e.message}`);
      }
  });

  const { mutate: schedule, isPending: isSchedulingMutation } = useMutation({
      mutationFn: updateScheduledDate,
      onSuccess: (updatedOrder) => {
          toast.dismiss("scheduling-toast");
          const type = updatedOrder.delivery_type === 'delivery' ? 'Delivery' : 'Pickup';
          toast.success(`${type} scheduled successfully!`);
          
          if (user?.username && orderInfo) {
            toast.info("Sending confirmation email...");
            
            const emailOrderPayload = {
              id: updatedOrder.id,
              scheduled_date: updatedOrder.scheduled_date,
              delivery_type: updatedOrder.delivery_type,
              delivery_zip_code: updatedOrder.delivery_zip_code,
            };
            
            sendEmail({
              order: emailOrderPayload,
              userEmail: user.username,
              puppies: orderInfo.puppies,
            });
          }

          setOrderInfo((prevData: any) => {
            if (!prevData) return null; // Should not happen if we are scheduling
            return {
                ...prevData,
                order: updatedOrder,
            }
          });
      },
      onError: (e: any) => {
          const type = orderInfo?.order?.delivery_type === 'delivery' ? 'delivery' : 'pickup';
          toast.error(`Failed to schedule ${type}: ${e.message}`, {
            description: "There might be an issue with your permissions or the server. Please try again or contact support if the problem persists.",
            id: "scheduling-toast",
          });
          console.error("Scheduling error details:", e);
      }
  });

  if (!session_id) {
    return <Navigate to="/" />;
  }

  // If we don't have a user object yet, it's likely due to the auth session
  // being restored after redirecting from Stripe. Show a loading indicator.
  if (!user) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin" />
            <p className="mt-4 text-lg text-muted-foreground">Loading your session...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  const deadline = orderInfo?.order?.scheduling_deadline ? new Date(orderInfo.order.scheduling_deadline) : addDays(new Date(), 15);
  const today = new Date();

  const handleScheduleSubmit = () => {
      toast.info("Attempting to schedule...", { id: "scheduling-toast" });

      if (!scheduledDate) {
        toast.error("Please select a date first.", { id: "scheduling-toast" });
        return;
      }
      if (!orderInfo?.order?.id) {
        toast.error("Could not find order information. Please refresh.", { id: "scheduling-toast" });
        return;
      }
      if (!session) {
        toast.error("Your session is invalid. Please refresh the page and try again.", { id: "scheduling-toast" });
        return;
      }

      schedule({ orderId: orderInfo.order.id, scheduledDate });
  }

  const alreadyScheduled = !!orderInfo?.order?.scheduled_date;
  const isDelivery = orderInfo?.order?.delivery_type === 'delivery';
  const scheduleType = isDelivery ? 'Delivery' : 'Pickup';

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              {isFinalizing && <CardTitle className="flex items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Finalizing Your Order...</CardTitle>}
              {error && <CardTitle className="flex items-center text-destructive"><AlertTriangle className="mr-2 h-6 w-6" /> Order Error</CardTitle>}
              {isSuccess && orderInfo && <CardTitle className="flex items-center text-green-600"><CheckCircle className="mr-2 h-6 w-6" /> Purchase Successful!</CardTitle>}
               <CardDescription>
                  {isSuccess && orderInfo && `Your order is confirmed. Now, please schedule your ${scheduleType.toLowerCase()}.`}
                  {error && "There was a problem with your order. Please contact support."}
               </CardDescription>
            </CardHeader>
            <CardContent>
              {isFinalizing && <div className="text-center py-8">Please wait while we confirm your payment and create your order.</div>}
              {error && <div className="text-center py-8 text-destructive">{(error as Error).message}</div>}
              {isSuccess && orderInfo && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-lg mb-2">Order Summary</h3>
                    <p><strong>Order ID:</strong> {orderInfo.order.id}</p>
                    <p><strong>Total:</strong> ${(orderInfo.order.total_amount / 100).toFixed(2)}</p>
                    <p><strong>Puppies:</strong> {orderInfo.puppies.map((p: any) => p.name || `Puppy #${p.id.substring(0,4)}`).join(', ')}</p>
                  </div>

                  <div className={`p-4 border-l-4 ${isDelivery ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-yellow-100 border-yellow-500 text-yellow-800'}`}>
                      <p className="font-bold flex items-center">{isDelivery && <Truck className="mr-2 h-5 w-5" />} Action Required: Schedule {scheduleType}</p>
                      <p>You must schedule your {scheduleType.toLowerCase()} by <strong>{format(deadline, 'PPP')}</strong>.</p>
                      {isDelivery && <p className="mt-2">We will contact you to coordinate a specific time for delivery to ZIP code <strong>{orderInfo.order.delivery_zip_code}</strong>.</p>}
                  </div>
                  
                  {alreadyScheduled ? (
                      <div className="p-4 bg-green-100 border-l-4 border-green-500 text-green-800">
                          <p className="font-bold">{scheduleType} Scheduled!</p>
                          <p>Your {scheduleType.toLowerCase()} is scheduled for <strong>{format(new Date(orderInfo.order.scheduled_date), isDelivery ? 'PPP' : 'PPPp')}</strong>.</p>
                      </div>
                  ) : (
                   <div className="space-y-4">
                      <p>Select a date for your {scheduleType.toLowerCase()}:</p>
                      <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => isBefore(date, today) || isAfter(date, deadline) }
                          initialFocus
                      />
                      <Button onClick={handleScheduleSubmit} disabled={!scheduledDate || isSchedulingMutation || isSendingEmail}>
                          {isSchedulingMutation ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CalendarIcon className="mr-2 h-4 w-4" />}
                          Confirm {scheduleType} Date
                      </Button>
                   </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {isSuccess && orderInfo && (
            <InvoiceViewer 
              order={orderInfo.order}
              puppies={orderInfo.puppies}
              customerInfo={{
                name: user?.username || 'Customer',
                email: user?.username || ''
              }}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SchedulePickupPage;
