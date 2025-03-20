import * as React from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // This is just a placeholder page as most of the OAuth handling is done in ApiKeysContext
    // This page will be shown briefly during the OAuth flow
    
    // If there's an error in the URL, show it
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");
    
    if (errorParam) {
      setStatus("error");
      setError(errorDescription || errorParam);
      
      // Show error toast
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: errorDescription || "Failed to authenticate with Coinbase.",
      });
      
      // Redirect back to home after a short delay
      setTimeout(() => {
        setLocation("/");
      }, 5000);
    } else {
      setStatus("success");
      
      // If no error, show success message and redirect will happen in ApiKeysContext
      toast({
        title: "Authentication Successful",
        description: "Successfully connected to Coinbase.",
      });
    }
  }, [setLocation, toast]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="max-w-md w-full bg-card-bg rounded-lg border border-[#3A3A3A] p-8 text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin h-10 w-10 border-4 border-[#0052FF] border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">Authenticating...</h2>
            <p className="text-gray-400">Connecting to your Coinbase account.</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="h-10 w-10 bg-blue-500 bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#0052FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Successful</h2>
            <p className="text-gray-400 mb-4">Successfully connected to your Coinbase account.</p>
            <p className="text-sm text-gray-500">Redirecting you back to the dashboard...</p>
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
            <p className="text-gray-400 mb-4">{error || "Failed to connect to your Coinbase account."}</p>
            <p className="text-sm text-gray-500">Redirecting you back to try again...</p>
          </>
        )}
      </div>
    </div>
  );
}