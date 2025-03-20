import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApiKeys } from "@/hooks/use-api-keys";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  
  const { initiateOAuthFlow, isAuthenticated } = useApiKeys();
  
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
      // Start the OAuth flow
      initiateOAuthFlow();
    } catch (error) {
      console.error('OAuth initiation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start authentication flow. Please try again.');
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
          <div className="bg-[#0052FF] bg-opacity-10 text-[#0052FF] text-sm p-3 rounded-md flex items-start">
            <span className="material-icons text-base mr-2 mt-0.5">info</span>
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
          </div>
        </div>
        
        <DialogFooter className="sm:justify-end">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
