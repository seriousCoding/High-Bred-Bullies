import * as React from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  addApiKey,
  getActiveApiKey,
  setActiveKeyId,
  clearActiveKey,
  getAllApiKeys,
  removeApiKey,
  VaultedApiKey,
} from "@/lib/apiKeyVault";

// Define the context shape for API keys management
interface ApiKeysContextType {
  // Current active API key
  activeApiKey: VaultedApiKey | null;
  // All stored API keys
  apiKeys: VaultedApiKey[];
  // Loading states
  isLoading: boolean;
  // Authentication status
  isAuthenticated: boolean;
  // API key management functions
  addNewApiKey: (label: string, apiKey: string, apiSecret: string) => Promise<void>;
  removeApiKeyById: (id: string) => Promise<void>;
  selectApiKey: (id: string) => void;
  logout: () => void;
  // Legacy OAuth support
  initiateOAuthFlow: () => Promise<void>;
}

// Create the context with a default empty value
export const ApiKeysContext = React.createContext<ApiKeysContextType>({
  activeApiKey: null,
  apiKeys: [],
  isLoading: false,
  isAuthenticated: false,
  addNewApiKey: async () => {},
  removeApiKeyById: async () => {},
  selectApiKey: () => {},
  logout: () => {},
  initiateOAuthFlow: async () => {},
});

interface ApiKeysProviderProps {
  children: React.ReactNode;
}

// OAuth2 configuration is kept for backward compatibility
const CLIENT_ID = import.meta.env.VITE_COINBASE_OAUTH_CLIENT_ID || "";
const REDIRECT_URI = window.location.origin + "/auth/callback";
const OAUTH_STATE_KEY = "auth_state_key";

// Debug OAuth configuration 
console.log("OAuth client configuration:", {
  client_id_available: !!CLIENT_ID,
  redirect_uri: REDIRECT_URI
});

export function ApiKeysProvider({ children }: ApiKeysProviderProps) {
  // State for API key management
  const [activeApiKey, setActiveApiKey] = React.useState<VaultedApiKey | null>(null);
  const [apiKeys, setApiKeys] = React.useState<VaultedApiKey[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Toast notifications
  const { toast } = useToast();
  
  // Load saved API keys from the vault on initial render
  React.useEffect(() => {
    const loadApiKeys = () => {
      try {
        // Get all API keys from the vault
        const keys = getAllApiKeys();
        setApiKeys(keys);
        
        // Get the active API key
        const active = getActiveApiKey();
        if (active) {
          setActiveApiKey(active);
          
          // Verify the active key with the server
          verifyApiKey(active);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load API keys from vault:", error);
        setIsLoading(false);
      }
    };
    
    loadApiKeys();
    
    // Also check for OAuth callback response for backward compatibility
    checkForOAuthResponse();
  }, []);
  
  // Verify an API key with the server
  const verifyApiKey = async (key: VaultedApiKey) => {
    try {
      // Make a test request to the server to verify the API key
      const response = await apiRequest('/api/accounts', {
        method: 'GET',
        headers: {
          'X-API-Key': key.apiKey,
          'X-API-Secret': key.apiSecret,
        },
      });
      
      if (response) {
        // Key is valid
        toast({
          title: 'Auto-Login Successful',
          description: `Connected using your saved API key: ${key.label}`,
        });
      }
    } catch (error) {
      console.error('API key verification failed:', error);
      toast({
        title: 'Auto-Login Failed',
        description: 'Your saved API key could not be verified. Please try again or add a new key.',
        variant: 'destructive',
      });
      
      // Don't remove the key automatically, as it might be a temporary server issue
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a new API key
  const addNewApiKey = async (label: string, apiKey: string, apiSecret: string) => {
    try {
      setIsLoading(true);
      
      // Store the key in our vault
      const newKey = addApiKey({
        label,
        apiKey,
        apiSecret,
        isActive: true,
      });
      
      // Register the key with the server (if needed)
      await apiRequest('/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          userId: 1, // In a real app, this would come from auth
          apiKey: apiKey,
          apiSecret: apiSecret,
          label: label,
          isActive: true
        })
      });
      
      // Update the local state
      setActiveApiKey(newKey);
      setApiKeys(getAllApiKeys());
      
      toast({
        title: 'API Key Added',
        description: `Your Coinbase API key "${label}" has been successfully added and activated.`,
      });
    } catch (error) {
      console.error('Error adding API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to add your API key. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Remove an API key
  const removeApiKeyById = async (id: string) => {
    try {
      setIsLoading(true);
      
      // If we're removing the active key, clear it first
      if (activeApiKey?.id === id) {
        setActiveApiKey(null);
      }
      
      // Remove the key from the vault
      removeApiKey(id);
      
      // Update the local state
      setApiKeys(getAllApiKeys());
      
      // Get the new active key if there is one
      const newActive = getActiveApiKey();
      if (newActive) {
        setActiveApiKey(newActive);
      }
      
      toast({
        title: 'API Key Removed',
        description: 'Your Coinbase API key has been removed from the vault.',
      });
    } catch (error) {
      console.error('Error removing API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove your API key. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Set an API key as active
  const selectApiKey = (id: string) => {
    try {
      // Get the key from the vault
      const keys = getAllApiKeys();
      const key = keys.find(k => k.id === id);
      
      if (key) {
        // Set as active in the vault
        setActiveKeyId(id);
        
        // Update the local state
        setActiveApiKey(key);
        
        toast({
          title: 'API Key Activated',
          description: `Now using "${key.label}" to connect to Coinbase.`,
        });
      }
    } catch (error) {
      console.error('Error selecting API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch API keys. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  // Logout - clear the active API key
  const logout = () => {
    clearActiveKey();
    setActiveApiKey(null);
    
    toast({
      title: 'Logged Out',
      description: 'You have been disconnected from Coinbase.',
    });
  };
  
  // ========================
  // Legacy OAuth Support
  // ========================
  
  // Check if current URL contains OAuth response (kept for backwards compatibility)
  const checkForOAuthResponse = () => {
    if (window.location.pathname === "/auth/callback") {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const savedState = localStorage.getItem(OAUTH_STATE_KEY);
      
      // Verify state to prevent CSRF attacks
      if (code && state && state === savedState) {
        // Clean up the state
        localStorage.removeItem(OAUTH_STATE_KEY);
        
        // Exchange code for token
        exchangeCodeForToken(code);
      }
    }
  };
  
  // Exchange authorization code for access token (kept for backwards compatibility)
  const exchangeCodeForToken = async (authCode: string) => {
    try {
      console.log("---------------------------------------------");
      console.log("CLIENT-SIDE TOKEN EXCHANGE - START");
      
      const response = await fetch("/api/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: REDIRECT_URI
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to exchange code for token");
      }
      
      const data = await response.json();
      
      // Convert OAuth token to API key format and store in vault
      if (data.access_token) {
        addApiKey({
          label: "Coinbase OAuth Connection",
          apiKey: data.access_token,
          apiSecret: data.refresh_token || "oauth-key",
          isActive: true,
        });
        
        // Update local state
        setApiKeys(getAllApiKeys());
        setActiveApiKey(getActiveApiKey());
        
        // Redirect to home page after successful login
        window.history.replaceState({}, document.title, "/");
      }
    } catch (error) {
      console.error("TOKEN EXCHANGE ERROR:", error);
    }
  };
  
  // Initiate OAuth login flow (kept for backwards compatibility)
  const initiateOAuthFlow = async () => {
    try {
      console.log("---------------------------------------------");
      console.log("INITIATING OAUTH CONNECTION FROM MODAL");
      console.log("Using server-side proxy for OAuth initialization");
      console.log("Redirect URI:", REDIRECT_URI);
      
      // First get the OAuth URL from the server
      const response = await fetch(`/api/oauth/init?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
      
      if (!response.ok) {
        throw new Error("Failed to initialize OAuth flow");
      }
      
      const data = await response.json();
      console.log("Received OAuth URL and state from server");
      
      // Store state for CSRF protection
      localStorage.setItem("auth_state_key", data.state);
      
      // Make a proxy request through our server to bypass CORS/connection issues
      console.log("Attempting to use server-side proxy to connect to Coinbase");
      const proxyResponse = await fetch(`/api/oauth/proxy?auth_url=${encodeURIComponent(data.auth_url)}`);
      
      if (!proxyResponse.ok) {
        throw new Error(`Proxy request failed with status: ${proxyResponse.status}`);
      }
      
      const proxyData = await proxyResponse.json();
      
      if (proxyData.redirect_url) {
        console.log("Received redirect URL from proxy, redirecting to enhanced redirect page...");
        
        // Redirect to our enhanced server-side redirect page
        window.location.href = `/auth/redirect?auth_url=${encodeURIComponent(data.auth_url)}&state=${encodeURIComponent(data.state)}`;
      }
    } catch (error) {
      console.error("OAUTH INITIALIZATION ERROR:", error);
      throw error; // Re-throw so the component can handle it
    }
  };
  
  return (
    <ApiKeysContext.Provider 
      value={{
        activeApiKey,
        apiKeys,
        isLoading,
        isAuthenticated: !!activeApiKey,
        addNewApiKey,
        removeApiKeyById,
        selectApiKey,
        logout,
        initiateOAuthFlow
      }}
    >
      {children}
    </ApiKeysContext.Provider>
  );
}
