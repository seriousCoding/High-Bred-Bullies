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
  const [authUrl, setAuthUrl] = React.useState("");
  const [showAuthUrl, setShowAuthUrl] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"oauth" | "manual">("oauth");
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
  
  // Reset form fields when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      setAuthCode("");
      setAuthUrl("");
      setShowAuthUrl(false);
      setError("");
    }
  }, [isOpen]);
  
  const handleConnectWithCoinbase = async () => {
    setIsSubmitting(true);
    setError("");
    
    try {
      console.log("---------------------------------------------");
      console.log("INITIATING OAUTH CONNECTION FROM MODAL");
      
      console.log("Using server-side proxy for OAuth initialization");
      console.log("Redirect URI:", window.location.origin + "/auth/callback");

      // For the manual tab, we need to get the URL but not redirect
      if (showAuthUrl) {
        // Just get the auth URL without redirecting
        const redirectUri = window.location.origin + "/auth/callback";
        const response = await fetch(`/api/oauth/init?redirect_uri=${encodeURIComponent(redirectUri)}`);
        
        if (!response.ok) {
          throw new Error("Failed to initialize OAuth flow");
        }
        
        const data = await response.json();
        setAuthUrl(data.auth_url);
        setIsSubmitting(false);
        return;
      }
      
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
  
  // Handle manual authorization code submission
  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCode.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Code",
        description: "Please enter the authorization code from Coinbase.",
      });
      return;
    }
    
    setIsSubmitting(true);
    setError("");
    
    try {
      console.log("---------------------------------------------");
      console.log("MANUAL OAUTH CODE SUBMISSION");
      console.log("Processing authorization code manually");
      
      const redirectUri = window.location.origin + "/auth/callback";
      console.log("Using redirect URI:", redirectUri);
      
      // Exchange the authorization code for access token
      const response = await fetch("/api/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: redirectUri
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to exchange code for token");
      }
      
      const data = await response.json();
      console.log("Token exchange successful");
      
      // Calculate token expiration time
      const expiresIn = data.expires_in || 7200; // default 2 hours
      const remember = true; // Always remember for OAuth tokens
      
      // Save tokens to context
      saveTokens(data.access_token, data.refresh_token, expiresIn, remember);
      
      toast({
        title: "Authentication Successful",
        description: "Successfully connected to your Coinbase account.",
      });
      
      onClose(); // Close the modal
    } catch (error) {
      console.error("---------------------------------------------");
      console.error("MANUAL CODE EXCHANGE ERROR");
      console.error("Error during manual code exchange:", error);
      
      // Show detailed error to help with debugging
      let errorMessage = 'Failed to authenticate with Coinbase. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error details:', error.stack);
      }
      
      console.error("Error message shown to user:", errorMessage);
      console.error("---------------------------------------------");
      
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: errorMessage,
      });
    } finally {
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
          <Tabs 
            defaultValue="oauth" 
            className="w-full"
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as "oauth" | "manual");
              if (value === "manual") {
                setShowAuthUrl(false);
              }
            }}
          >
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
                <div className="flex-1">
                  <p className="mb-2">Use this method if the automatic redirect isn't working:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Click "Get Authorization URL"</li>
                    <li>Copy the URL that appears and open it in a new browser tab</li>
                    <li>Log in to Coinbase and authorize this app</li>
                    <li>After authorization, you'll be redirected to a page with a URL containing <code className="bg-gray-900 px-1 rounded">code=XXXX</code></li>
                    <li>Copy the entire code value (after <code className="bg-gray-900 px-1 rounded">code=</code> and before any <code className="bg-gray-900 px-1 rounded">&</code> character)</li>
                    <li>Paste it below and click "Submit Code"</li>
                  </ol>
                  
                  <div className="mt-2 bg-gray-800 p-2 rounded text-xs">
                    <p className="font-semibold text-white">Example:</p>
                    <p className="break-all text-gray-400">From: <code>https://example.com/callback?code=<span className="text-green-400 font-bold">fe2b195b5ffe427f8e154eb1</span>&state=abc123</code></p>
                    <p className="break-all text-gray-400">Copy: <code className="text-green-400 font-bold">fe2b195b5ffe427f8e154eb1</code></p>
                  </div>
                </div>
              </div>
              
              {authUrl ? (
                <div className="mb-4 space-y-3">
                  <div className="bg-blue-900 bg-opacity-20 text-blue-400 text-sm p-3 rounded-md">
                    <p className="font-semibold mb-1">Authorization URL:</p>
                    <div className="bg-gray-900 p-2 rounded overflow-x-auto">
                      <code className="text-xs break-all">{authUrl}</code>
                    </div>
                    <div className="flex justify-between mt-2">
                      <Button 
                        type="button"
                        size="sm"
                        onClick={() => window.open(authUrl, '_blank')}
                        className="bg-[#0052FF] text-white text-xs hover:bg-blue-600"
                      >
                        Open URL
                      </Button>
                      <Button 
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(authUrl);
                          toast({
                            title: "URL Copied",
                            description: "Authorization URL copied to clipboard",
                          });
                        }}
                        className="border-[#0052FF] text-[#0052FF] text-xs hover:bg-[#0052FF] hover:bg-opacity-10"
                      >
                        Copy URL
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              
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
                    onClick={() => {
                      setShowAuthUrl(true);
                      handleConnectWithCoinbase();
                    }}
                    disabled={isSubmitting}
                    className="border-[#0052FF] text-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10"
                  >
                    {isSubmitting && !authUrl ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#0052FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Getting URL...
                      </>
                    ) : "Get Authorization URL"}
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
