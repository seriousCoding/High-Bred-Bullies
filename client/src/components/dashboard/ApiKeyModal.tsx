import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useApiKeys } from "@/hooks/use-api-keys";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [authCode, setAuthCode] = React.useState("");
  const { toast } = useToast();
  
  const { initiateOAuthFlow, isAuthenticated, saveTokens } = useApiKeys();
  
  // Clear form when modal is opened
  React.useEffect(() => {
    if (isOpen) {
      setError("");
    }
  }, [isOpen]);
  
  React.useEffect(() => {
    // Close modal if authenticated
    if (isAuthenticated && isOpen) {
      onClose();
    }
  }, [isAuthenticated, isOpen, onClose]);
  
  const handleConnectWithCoinbase = async () => {
    setIsSubmitting(true);
    setError("");
    
    try {
      console.log("---------------------------------------------");
      console.log("INITIATING OAUTH CONNECTION FROM MODAL");
      
      console.log("Using server-side proxy for OAuth initialization");
      console.log("Redirect URI:", window.location.origin + "/auth/callback");
      
      // Start the OAuth flow - this will redirect to Coinbase via the server proxy
      await initiateOAuthFlow();
      
      // Note: The page will navigate away, so any code after initiateOAuthFlow()
      // won't execute unless there's an error that prevents navigation
    } catch (error) {
      console.error("---------------------------------------------");
      console.error("OAUTH INITIATION ERROR");
      console.error("Error initiating OAuth flow:", error);
      
      // Show detailed error to help with debugging
      let errorMessage = 'Failed to start authentication flow. Please try again.';
      if (error instanceof Error) {
        errorMessage = `${error.name}: ${error.message}`;
        console.error('Error details:', error.stack);
      }
      
      console.error("Error message shown to user:", errorMessage);
      console.error("---------------------------------------------");
      
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card-bg border-[#3A3A3A] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">Connect to Coinbase</DialogTitle>
          <DialogDescription className="text-gray-300">
            Connect your Coinbase account to access your trading data and market information.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-900 bg-opacity-20 text-red-400 text-sm p-3 rounded-md flex items-start">
            <span className="material-icons text-base mr-2 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-4">
          <Tabs defaultValue="oauth" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oauth">OAuth Login</TabsTrigger>
              <TabsTrigger value="manual">Manual Code Entry</TabsTrigger>
            </TabsList>
            
            <TabsContent value="oauth" className="space-y-4 mt-4">
              <div className="bg-[#0052FF] bg-opacity-10 text-[#0052FF] text-sm p-3 rounded-md flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  You'll be redirected to Coinbase to securely login and authorize this application.
                  No credentials will be stored on this site.
                </span>
              </div>
              
              <div className="flex flex-col items-center justify-center py-4">
                <img 
                  src="https://www.coinbase.com/assets/logos/coinbase.svg" 
                  alt="Coinbase Logo" 
                  className="h-12 mb-4" 
                />
                <p className="text-sm text-gray-300 text-center mb-4">
                  This application requires permission to read your Coinbase accounts, transactions, and other data.
                  You can revoke access at any time from your Coinbase settings.
                </p>
                
                <div className="w-full bg-gray-800 bg-opacity-50 rounded-md p-3 text-xs text-gray-400">
                  <p className="font-semibold mb-1 text-gray-300">Permissions requested:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Read account balances and currencies</li>
                    <li>View transaction history</li>
                    <li>Place and manage orders</li>
                    <li>Read user profile information</li>
                    <li>View payment methods (read-only)</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-[#3A3A3A] text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConnectWithCoinbase}
                  disabled={isSubmitting}
                  className="bg-[#0052FF] text-white hover:bg-blue-600"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Redirecting...
                    </>
                  ) : (
                    "Connect with Coinbase"
                  )}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="bg-amber-900 bg-opacity-20 text-amber-400 text-sm p-3 rounded-md flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  Use this method if the automatic redirect isn't working. You'll need to:
                  <ol className="list-decimal list-inside mt-1">
                    <li>Click "Get Authorization URL"</li>
                    <li>Log in to Coinbase and authorize this app</li>
                    <li>Copy the code from the URL</li>
                    <li>Paste it below and click "Submit Code"</li>
                  </ol>
                </span>
              </div>
              
              <form onSubmit={handleManualCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth-code">Authorization Code</Label>
                  <Input
                    id="auth-code"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Paste the authorization code here"
                    className="bg-gray-800 border-gray-700"
                  />
                  <p className="text-xs text-gray-400">
                    The authorization code is in the URL after you approve access on Coinbase, 
                    in the format: <code className="bg-gray-900 px-1 rounded">...code=XXXX...</code>
                  </p>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="border-[#3A3A3A] text-gray-300 hover:text-white hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button" 
                    variant="outline"
                    onClick={handleConnectWithCoinbase}
                    className="border-[#0052FF] text-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10"
                  >
                    Get Authorization URL
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !authCode}
                    className="bg-[#0052FF] text-white hover:bg-blue-600"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      "Submit Code"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
