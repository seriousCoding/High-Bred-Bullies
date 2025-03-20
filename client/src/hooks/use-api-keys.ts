import * as React from "react";
import { ApiKeysContext } from "@/context/ApiKeysContext";
import type { VaultedApiKey } from "@/lib/apiKeyVault";

export function useApiKeys() {
  const context = React.useContext(ApiKeysContext);
  
  if (context === null) {
    throw new Error("useApiKeys must be used within an ApiKeysProvider");
  }
  
  // Get active API key details for use in API calls
  const activeKey = context.activeApiKey;
  
  return {
    ...context,
    // Provide all vault-related actions
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
