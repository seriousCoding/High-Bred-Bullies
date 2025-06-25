import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Home, User, Calendar } from 'lucide-react';

export const PurchaseSuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  
  const sessionId = searchParams.get('session_id');
  const isMock = searchParams.get('mock') === 'true';
  const amount = searchParams.get('amount');
  const puppyCount = searchParams.get('puppies');

  const formatAmount = (cents: string) => {
    return (parseInt(cents) / 100).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-700">
            Purchase Successful!
          </CardTitle>
          <CardDescription>
            Your puppy purchase has been processed successfully
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isMock && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Badge variant="outline" className="mb-2">Demo Mode</Badge>
              <p className="text-sm text-blue-700">
                This is a demonstration purchase. No actual payment was processed.
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Session ID:</span>
              <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {sessionId?.substring(0, 12)}...
              </span>
            </div>
            
            {amount && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Amount:</span>
                <span className="text-lg font-bold text-green-600">
                  ${formatAmount(amount)}
                </span>
              </div>
            )}
            
            {puppyCount && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Puppies Purchased:</span>
                <Badge variant="secondary">{puppyCount}</Badge>
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">What's Next?</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Check your email for purchase confirmation</li>
              <li>• Breeder will contact you within 24 hours</li>
              <li>• Schedule pickup or delivery arrangements</li>
              <li>• Prepare for your new puppy's arrival</li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => navigate('/profile')}
              className="w-full"
            >
              <User className="w-4 h-4 mr-2" />
              View Order History
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => navigate(`/schedule-pickup/${sessionId || 'new'}`)}
              className="w-full"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Pickup
            </Button>
            
            <Button 
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};