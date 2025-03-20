import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useApiKeys } from "@/hooks/use-api-keys";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const { saveKeys } = useApiKeys();
  
  // Clear form when modal is opened
  useEffect(() => {
    if (isOpen) {
      setError("");
    }
  }, [isOpen]);
  
  const handleConnect = async () => {
    if (!apiKey || !apiSecret) {
      setError("Please enter both API key and secret");
      return;
    }
    
    setIsSubmitting(true);
    setError("");
    
    try {
      // Test connection with provided credentials
      const response = await fetch('/api/accounts', {
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret
        }
      });
      
      if (!response.ok) {
        throw new Error('Invalid API credentials. Please check and try again.');
      }
      
      // Save credentials if successful
      saveKeys(apiKey, apiSecret, rememberCredentials);
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('API key validation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card-bg border-[#3A3A3A] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">API Credentials</DialogTitle>
          <DialogDescription className="text-gray-300">
            Enter your Coinbase Advanced Trade API credentials to connect your account.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-900 bg-opacity-20 text-red-400 text-sm p-3 rounded-md flex items-start">
            <span className="material-icons text-base mr-2 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="text-sm text-gray-400">API Key</Label>
            <Input
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="bg-dark-bg border-[#3A3A3A] text-white focus:ring-[#0052FF] focus:border-[#0052FF]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-secret" className="text-sm text-gray-400">API Secret</Label>
            <div className="relative">
              <Input
                id="api-secret"
                type={showSecret ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your API secret"
                className="bg-dark-bg border-[#3A3A3A] text-white focus:ring-[#0052FF] focus:border-[#0052FF] pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setShowSecret(!showSecret)}
              >
                <span className="material-icons text-base">
                  {showSecret ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>
          
          <div className="bg-[#0052FF] bg-opacity-10 text-[#0052FF] text-sm p-3 rounded-md flex items-start">
            <span className="material-icons text-base mr-2 mt-0.5">info</span>
            <span>
              API keys provide access to your Coinbase account. Make sure you have created a key with appropriate permissions.
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="remember" 
              checked={rememberCredentials} 
              onCheckedChange={(checked) => setRememberCredentials(checked as boolean)}
              className="text-[#0052FF] border-[#3A3A3A]"
            />
            <Label htmlFor="remember" className="text-sm text-gray-300">
              Remember credentials (encrypted)
            </Label>
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
            onClick={handleConnect}
            disabled={isSubmitting}
            className="bg-[#0052FF] text-white hover:bg-blue-600"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              "Connect Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
