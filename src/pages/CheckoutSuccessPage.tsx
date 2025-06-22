
import React, { useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { InvoiceViewer } from '@/components/InvoiceViewer';

const finalizeOrder = async ({ session_id, token }: { session_id: string; token: string }) => {
  const { data, error } = await supabase.functions.invoke('finalize-litter-order', {
    body: { session_id },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

const CheckoutSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const sessionId = searchParams.get('session_id');

  const { mutate, isPending, isSuccess, isError, error, data: orderData } = useMutation({
    mutationFn: finalizeOrder
  });

  useEffect(() => {
    if (sessionId && session?.access_token) {
      mutate({ session_id: sessionId, token: session.access_token });
    } else if (!sessionId) {
      toast.error("No session ID found, cannot finalize order.");
      navigate('/');
    }
  }, [sessionId, session, mutate, navigate]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-6">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto bg-green-100 rounded-full p-4 w-fit">
                {isPending && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
                {isSuccess && <CheckCircle className="h-12 w-12 text-green-600" />}
                {isError && <CheckCircle className="h-12 w-12 text-destructive" />}
              </div>
              <CardTitle className="mt-4 text-2xl">
                {isPending && "Finalizing Your Order..."}
                {isSuccess && "Payment Successful!"}
                {isError && "An Error Occurred"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPending && <p className="text-muted-foreground">Please wait while we confirm your puppy reservation.</p>}
              {isSuccess && (
                <>
                  <p className="text-muted-foreground">
                    Thank you for your purchase! Your reservation is complete. You will receive a confirmation email shortly.
                  </p>
                  <Button asChild>
                    <Link to="/high-table">Go to High Table</Link>
                  </Button>
                </>
              )}
              {isError && (
                <>
                  <p className="text-muted-foreground">
                    There was a problem finalizing your order. Please contact support.
                  </p>
                  <p className="text-sm text-red-500">{error?.message}</p>
                  <Button asChild>
                    <Link to="/">Return Home</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {isSuccess && orderData && (
            <InvoiceViewer 
              order={orderData.order}
              puppies={orderData.puppies}
              customerInfo={{
                name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Customer',
                email: user?.email || ''
              }}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CheckoutSuccessPage;
