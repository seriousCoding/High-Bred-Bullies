import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUnifiedAuth } from '@/hooks/use-unified-auth';
import { Loader2 } from 'lucide-react';

export default function UnifiedAuthPage() {
  const [location, navigate] = useLocation();
  const { user, isLoading, loginWithOAuth } = useUnifiedAuth();

  // Check if user is authenticated with Coinbase
  useEffect(() => {
    if (!isLoading && user?.authenticated && user?.authType) {
      // If already authenticated with Coinbase, redirect to dashboard
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  // Check if this page was opened after a successful OAuth callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle message from popup window
      if (event.data && event.data.type === 'oauth_success') {
        window.location.reload();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleOAuthLogin = () => {
    loginWithOAuth();
  };

  // Show loading indicator while checking auth status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="flex flex-col lg:flex-row max-w-6xl w-full bg-card rounded-xl overflow-hidden shadow-xl">
        {/* Left column - Auth form */}
        <div className="w-full lg:w-1/2 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Coinbase Trading App</h1>
            <p className="text-gray-400 mt-2">Connect with your Coinbase account to start trading</p>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Authentication</CardTitle>
              <CardDescription>Choose your authentication method</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full bg-[#0052FF] hover:bg-[#0039B3] text-white"
                onClick={handleOAuthLogin}
                size="lg"
              >
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6Z"
                    fill="currentColor"
                  />
                </svg>
                Sign in with Coinbase
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-700"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-800 px-2 text-gray-400">Or continue with</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full border-gray-700 text-white hover:bg-gray-700"
                onClick={() => navigate('/api-key-auth')}
              >
                API Key Authentication
              </Button>
            </CardContent>
            <CardFooter className="text-sm text-gray-400">
              By connecting, you agree to Coinbase's Terms of Service and Privacy Policy.
            </CardFooter>
          </Card>
        </div>

        {/* Right column - Hero section */}
        <div
          className="w-full lg:w-1/2 p-8 bg-gradient-to-br from-blue-900 to-indigo-900 flex flex-col justify-center items-center text-center"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Trading Made Simple</h2>
            <p className="text-blue-100 max-w-sm mx-auto">
              Access real-time market data, manage your portfolio, and execute trades all in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left w-full max-w-md">
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-white">Real-Time Data</h3>
              <p className="text-blue-200 text-sm mt-1">
                Access live market data from Coinbase's Advanced Trade API
              </p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-white">Secure Trading</h3>
              <p className="text-blue-200 text-sm mt-1">
                Execute trades with your authenticated Coinbase account
              </p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-white">Portfolio Tracking</h3>
              <p className="text-blue-200 text-sm mt-1">
                Monitor your holdings and performance over time
              </p>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <h3 className="font-semibold text-white">Advanced Charts</h3>
              <p className="text-blue-200 text-sm mt-1">
                Visualize market trends with interactive price charts
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}