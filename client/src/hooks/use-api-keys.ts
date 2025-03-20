import * as React from "react";
import { ApiKeysContext } from "@/context/ApiKeysContext";

export function useApiKeys() {
  const context = React.useContext(ApiKeysContext);
  
  if (!context) {
    throw new Error("useApiKeys must be used within an ApiKeysProvider");
  }
  
  return {
    ...context,
    // For backward compatibility
    hasKeys: context.isAuthenticated,
    apiKey: context.accessToken,
    apiSecret: context.refreshToken,
    saveKeys: (key: string, secret: string, remember: boolean) => {
      // This function is kept for backward compatibility but will log a deprecation warning
      console.warn('saveKeys is deprecated. Please use saveTokens or initiateOAuthFlow instead.');
      context.saveTokens(key, secret, 3600, remember);
    },
    clearKeys: context.logout
  };
}
