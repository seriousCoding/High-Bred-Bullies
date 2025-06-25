import * as React from "react";
import { ApiKeysContext } from "@/context/ApiKeysContext";
import type { VaultedApiKey } from "@/lib/apiKeyVault";

interface ApiKeysReturnType {
  // Current state
  activeApiKey: VaultedApiKey | null;
  apiKeys: VaultedApiKey[];
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // API key management
  addNewApiKey: (label: string, apiKey: string, apiSecret: string) => Promise<void>;
  removeApiKeyById: (id: string) => Promise<void>;
  selectApiKey: (id: string) => void;
  logout: () => void;
  
  // Backward compatibility
  hasKeys: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  
  // Aliases for easier use
  allApiKeys: VaultedApiKey[];
  currentKey: VaultedApiKey | null;
  addKey: (label: string, apiKey: string, apiSecret: string) => Promise<void>;
  removeKey: (id: string) => Promise<void>;
  selectKey: (id: string) => void;
  saveKeys: (key: string, secret: string, remember: boolean) => void;
  clearKeys: () => void;
  
  // Legacy support
  initiateOAuthFlow: () => Promise<void>;
}

// Default empty implementation for standalone testing
const defaultContext: ApiKeysReturnType = {
  activeApiKey: null,
  apiKeys: [],
  isLoading: false,
  isAuthenticated: false,
  addNewApiKey: async () => {},
  removeApiKeyById: async () => {},
  selectApiKey: () => {},
  logout: () => {},
  hasKeys: false,
  apiKey: null,
  apiSecret: null,
  allApiKeys: [],
  currentKey: null,
  addKey: async () => {},
  removeKey: async () => {},
  selectKey: () => {},
  saveKeys: () => {},
  clearKeys: () => {},
  initiateOAuthFlow: async () => {},
};

export function useApiKeys(): ApiKeysReturnType {
  const context = React.useContext(ApiKeysContext);
  
  if (context === null) {
    console.error("useApiKeys must be used within an ApiKeysProvider");
    return defaultContext;
  }
  
  // Get active API key details for use in API calls
  const activeKey = context.activeApiKey;
  
  return {
    // Original context values
    ...context,
    
    // Aliased properties for convenience
    hasKeys: context.isAuthenticated,
    allApiKeys: context.apiKeys,
    currentKey: activeKey,
    
    // For direct API usage (current active key)
    apiKey: activeKey?.apiKey || null,
    apiSecret: activeKey?.apiSecret || null,
    
    // Helper functions for API key management
    addKey: context.addNewApiKey,
    removeKey: context.removeApiKeyById,
    selectKey: context.selectApiKey,
    
    // For backward compatibility with older code
    saveKeys: (key: string, secret: string, remember: boolean) => {
      console.warn('saveKeys is deprecated. Please use addNewApiKey instead.');
      context.addNewApiKey('Manual API Key', key, secret);
    },
    clearKeys: context.logout
  };
}
