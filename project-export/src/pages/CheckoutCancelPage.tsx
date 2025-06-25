
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const CheckoutCancelPage = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto bg-red-100 rounded-full p-4 w-fit">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <CardTitle className="mt-4 text-2xl">Payment Canceled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your payment was canceled. Your cart has been saved, and you can try again anytime.
            </p>
            <Button asChild>
              <Link to="/litters">Return to Litters</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default CheckoutCancelPage;
