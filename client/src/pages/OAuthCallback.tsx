import * as React from "react";
import { useLocation } from "wouter";
import { useApiKeys } from "@/hooks/use-api-keys";
import { Loader2 } from "lucide-react";

export default function OAuthCallback() {
  const [location, setLocation] = useLocation();
  const { saveTokens } = useApiKeys();
  const [error, setError] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(true);

  React.useEffect(() => {
    const processOAuthCallback = async () => {
      try {
        // Get the authorization code and state from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        
        if (!code) {
          throw new Error("Authorization code is missing from the callback URL");
        }
        
        // Verify state parameter to prevent CSRF attacks
        const savedState = localStorage.getItem("coinbase_oauth_state");
        if (!state || state !== savedState) {
          throw new Error("Invalid state parameter - possible CSRF attack");
        }
        
        // Clean up the state parameter
        localStorage.removeItem("coinbase_oauth_state");
        
        // Exchange the code for an access token
        const response = await fetch("/api/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin + "/oauth/callback"
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to exchange code for token");
        }
        
        const data = await response.json();
        
        // Save the tokens
        saveTokens(
          data.access_token,
          data.refresh_token,
          data.expires_in,
          true // Always remember OAuth tokens
        );
        
        // Redirect to the dashboard
        setLocation("/");
      } catch (error) {
        console.error("OAuth callback error:", error);
        setError(error instanceof Error ? error.message : "An unknown error occurred");
        setIsProcessing(false);
      }
    };
    
    processOAuthCallback();
  }, [saveTokens, setLocation]);
  
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-md p-6 bg-card-bg rounded-lg shadow-xl border border-[#3A3A3A]">
        <h1 className="text-2xl font-bold text-center mb-6">
          {isProcessing ? "Connecting to Coinbase..." : error ? "Authentication Error" : "Connected!"}
        </h1>
        
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 text-[#0052FF] animate-spin mb-4" />
            <p className="text-gray-300 text-center">
              Please wait while we authenticate your Coinbase account...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-900 bg-opacity-20 text-red-400 p-4 rounded-md mb-4">
            <h3 className="font-medium mb-2">Error Details:</h3>
            <p>{error}</p>
          </div>
        ) : null}
        
        {error && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setLocation("/")}
              className="px-4 py-2 bg-[#0052FF] text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-8 text-gray-400 text-sm text-center">
        <p>
          This application securely exchanges authorization codes with Coinbase.
          <br />
          No sensitive data is stored on our servers.
        </p>
      </div>
    </div>
  );
}