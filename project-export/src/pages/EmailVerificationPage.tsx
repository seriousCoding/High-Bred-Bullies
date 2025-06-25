import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';

interface VerificationState {
  status: 'loading' | 'success' | 'error' | 'expired';
  message: string;
}

export default function EmailVerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [verification, setVerification] = useState<VerificationState>({
    status: 'loading',
    message: 'Verifying your email...'
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');

    if (!token) {
      setVerification({
        status: 'error',
        message: 'Invalid verification link. No token found.'
      });
      return;
    }

    verifyEmail(token);
  }, [location]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerification({
          status: 'success',
          message: 'Your email has been verified successfully!'
        });
      } else {
        const status = data.error?.includes('expired') ? 'expired' : 'error';
        setVerification({
          status,
          message: data.error || 'Email verification failed.'
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerification({
        status: 'error',
        message: 'Failed to verify email. Please try again.'
      });
    }
  };

  const handleContinue = () => {
    navigate('/');
  };

  const getIcon = () => {
    switch (verification.status) {
      case 'loading':
        return <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'expired':
        return <Mail className="h-16 w-16 text-orange-500" />;
      case 'error':
      default:
        return <XCircle className="h-16 w-16 text-red-500" />;
    }
  };

  const getTitle = () => {
    switch (verification.status) {
      case 'loading':
        return 'Verifying Email...';
      case 'success':
        return 'Email Verified!';
      case 'expired':
        return 'Link Expired';
      case 'error':
      default:
        return 'Verification Failed';
    }
  };

  const getDescription = () => {
    switch (verification.status) {
      case 'loading':
        return 'Please wait while we verify your email address.';
      case 'success':
        return 'Thank you for verifying your email! You now have full access to all High Bred Bullies features.';
      case 'expired':
        return 'This verification link has expired. Please request a new verification email from your profile settings.';
      case 'error':
      default:
        return 'We encountered an issue verifying your email. Please try again or contact support if the problem persists.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              {getIcon()}
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {getTitle()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600 leading-relaxed">
              {getDescription()}
            </p>
            
            {verification.status !== 'loading' && (
              <div className="pt-4">
                <Button 
                  onClick={handleContinue}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  size="lg"
                >
                  {verification.status === 'success' ? 'Continue to High Bred Bullies' : 'Go to Homepage'}
                </Button>
              </div>
            )}
            
            {verification.status === 'expired' && (
              <div className="pt-2">
                <Button 
                  variant="outline"
                  onClick={() => navigate('/profile')}
                  className="w-full"
                >
                  Request New Verification Email
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            High Bred Bullies - Premium American Bully Community
          </p>
        </div>
      </div>
    </div>
  );
}