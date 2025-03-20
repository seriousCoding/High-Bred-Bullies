import * as React from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useApiKeys } from "@/hooks/use-api-keys";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { saveTokens } = useApiKeys();
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [exchangeInProgress, setExchangeInProgress] = React.useState(false);
  const [autoExchangeAttempted, setAutoExchangeAttempted] = React.useState(false);

  // Auto-process the token exchange as soon as the component mounts
  React.useEffect(() => {
    // Run the token exchange automatically on mount
    const autoExchange = async () => {
      // Don't run if already attempted
      if (autoExchangeAttempted) return;
      setAutoExchangeAttempted(true);
      
      try {
        await handleTokenExchange();
      } catch (err) {
        // Error is already handled in handleTokenExchange
        console.error("Auto exchange failed:", err);
      }
    };

    // Only run auto exchange if we have a code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      autoExchange();
    }
  }, [autoExchangeAttempted]);

  React.useEffect(() => {
    // Comprehensive logging for debugging OAuth process
    console.log("---------------------------------------------");
    console.log("OAUTH CALLBACK PROCESSING");
    console.log("Full callback URL:", window.location.href);
    console.log("Callback path:", window.location.pathname);
    console.log("Search params:", window.location.search);
    
    // Parse all relevant URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    
    // Try to get state from both storage mechanisms for redundancy
    const savedStateLocal = localStorage.getItem("auth_state_key");
    const savedStateSession = sessionStorage.getItem("auth_state_key");
    // Use whichever state is available, prioritizing localStorage
    const savedState = savedStateLocal || savedStateSession;
    
    // Log details about what we found
    console.log("OAuth callback parameter analysis:");
    console.log("- error param:", errorParam || "not present");
    console.log("- error_description:", errorDescription || "not present");
    console.log("- code:", code ? `present (${code.length} characters)` : "not present");
    console.log("- state:", state || "not present");
    console.log("- saved state:", savedState ? `present (${savedState.length} characters)` : "not present");
    console.log("- state match:", state === savedState ? "YES" : "NO");
    
    console.log("Received parameters:", {
      has_code: !!code,
      has_state: !!state,
      code_length: code ? code.length : 0,
      state_match: state === savedState,
      error: errorParam || "none"
    });
    
    if (errorParam) {
      // Error in the OAuth flow
      console.error("OAuth error returned from provider:", errorParam);
      console.error("Error description:", errorDescription);
      
      setStatus("error");
      setError(errorDescription || errorParam);
      
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: errorDescription || "Failed to authenticate with your account.",
      });
      
      // Redirect back to home after a short delay
      setTimeout(() => {
        setLocation("/");
      }, 5000);
    } else if (code) {
      // Code received, check state before proceeding
      console.log("Authorization code received successfully");
      
      if (!state || !savedState) {
        // In case state is missing, still try to proceed
        console.warn("State validation was skipped - either state or saved state is missing");
        localStorage.setItem("oauth_code", code); // Save for manual exchange
        setStatus("success");
        
        toast({
          title: "Authentication Processing",
          description: "Connecting to your account...",
        });
      }
      else if (state === savedState) {
        console.log("State validation passed: tokens will be exchanged");
        // Store code for ApiKeysContext to find
        localStorage.setItem("oauth_code", code);
        setStatus("success");
        
        // State matched, show success message
        toast({
          title: "Authentication Successful",
          description: "Successfully connected to your account.",
        });
      } else {
        console.error("State validation failed - possible CSRF attack or state was lost");
        setStatus("error");
        setError("Security validation failed. Please try again.");
        
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: "Security verification failed. Please try again.",
        });
        
        // Redirect back to home after a short delay
        setTimeout(() => {
          setLocation("/");
        }, 5000);
      }
    } else {
      // Neither code nor error found in URL parameters
      console.error("OAuth callback missing required parameters (both code and error are absent)");
      setStatus("error");
      setError("Missing authentication data. Please try again.");
      
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: "Missing authentication data. Please try again.",
      });
      
      // Redirect back to home after a short delay
      setTimeout(() => {
        setLocation("/");
      }, 5000);
    }
  }, [setLocation, toast]);

  // Function for token exchange
  const handleTokenExchange = async () => {
    try {
      setExchangeInProgress(true);
      
      // First try to get code from URL params
      const urlParams = new URLSearchParams(window.location.search);
      let code = urlParams.get("code");
      
      // If not in URL, try localStorage as fallback
      if (!code) {
        code = localStorage.getItem("oauth_code");
      }
      
      if (!code) {
        throw new Error("Authorization code not found");
      }

      console.log("---------------------------------------------");
      console.log("MANUAL TOKEN EXCHANGE INITIATED");
      console.log("- Code length:", code.length);
      console.log("- Using redirect URI:", window.location.origin + "/auth/callback");

      const redirectUri = window.location.origin + "/auth/callback";
      const response = await fetch("/api/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to exchange token");
      }

      const data = await response.json();
      console.log("TOKEN EXCHANGE SUCCESSFUL");

      // Calculate expiration time
      const expiresIn = data.expires_in || 7200; // default 2 hours
      
      // Save tokens using the context provider function
      saveTokens(data.access_token, data.refresh_token, expiresIn, true);
      
      // Clear temporary data
      localStorage.removeItem("oauth_code");
      localStorage.removeItem("auth_state_key");

      toast({
        title: "Authentication Complete",
        description: "Successfully connected to your Coinbase account.",
      });

      console.log("Tokens saved, redirecting to home page");
      console.log("---------------------------------------------");
      
      // Redirect to home
      setLocation("/");
    } catch (error) {
      console.error("---------------------------------------------");
      console.error("TOKEN EXCHANGE ERROR");
      console.error("Error during token exchange:", error);
      console.error("---------------------------------------------");
      
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Could not complete the authentication process. Please try again.",
      });
      
      setStatus("error");
      setError(error instanceof Error ? error.message : "Unknown error");
      setExchangeInProgress(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="max-w-md w-full bg-card-bg rounded-lg border border-[#3A3A3A] p-8 text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin h-10 w-10 border-4 border-[#0052FF] border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">Authenticating...</h2>
            <p className="text-gray-400">Connecting to your trading account.</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="h-10 w-10 bg-blue-500 bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Processing</h2>
            <p className="text-gray-400 mb-4">Successfully received your authorization.</p>
            <p className="text-sm text-gray-500 mb-4">If you're not redirected automatically, please click the button below.</p>
            
            <Button 
              onClick={handleTokenExchange} 
              disabled={exchangeInProgress}
              className="w-full bg-[#0052FF] hover:bg-[#0039B3] text-white font-medium py-2"
            >
              {exchangeInProgress ? (
                <>
                  <span className="mr-2 inline-block animate-spin">↻</span>
                  Processing...
                </>
              ) : "Complete Login"}
            </Button>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="h-10 w-10 bg-red-500 bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
            <p className="text-gray-400 mb-4">{error || "Failed to connect to your trading account."}</p>
            <p className="text-sm text-gray-500 mb-4">You can try authenticating again.</p>
            
            <Button 
              onClick={() => setLocation("/")} 
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2"
            >
              Return to Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}