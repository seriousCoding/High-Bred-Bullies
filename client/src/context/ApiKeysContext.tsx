import { createContext, useState, useEffect, ReactNode } from "react";

interface ApiKeysContextType {
  apiKey: string | null;
  apiSecret: string | null;
  hasKeys: boolean;
  saveKeys: (key: string, secret: string, remember: boolean) => void;
  clearKeys: () => void;
}

export const ApiKeysContext = createContext<ApiKeysContextType | null>(null);

interface ApiKeysProviderProps {
  children: ReactNode;
}

export function ApiKeysProvider({ children }: ApiKeysProviderProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiSecret, setApiSecret] = useState<string | null>(null);
  
  // Load saved keys from localStorage on initial render
  useEffect(() => {
    const savedKey = localStorage.getItem("coinbase_api_key");
    const savedSecret = localStorage.getItem("coinbase_api_secret");
    
    if (savedKey && savedSecret) {
      try {
        // In a real app, these would be encrypted/securely stored
        setApiKey(savedKey);
        setApiSecret(savedSecret);
      } catch (error) {
        console.error("Failed to load API keys:", error);
        // Clear potentially corrupted data
        localStorage.removeItem("coinbase_api_key");
        localStorage.removeItem("coinbase_api_secret");
      }
    }
  }, []);
  
  // Save API keys
  const saveKeys = (key: string, secret: string, remember: boolean) => {
    setApiKey(key);
    setApiSecret(secret);
    
    if (remember) {
      // In a real app, these would be encrypted/securely stored
      localStorage.setItem("coinbase_api_key", key);
      localStorage.setItem("coinbase_api_secret", secret);
    }
  };
  
  // Clear API keys
  const clearKeys = () => {
    setApiKey(null);
    setApiSecret(null);
    localStorage.removeItem("coinbase_api_key");
    localStorage.removeItem("coinbase_api_secret");
  };
  
  return (
    <ApiKeysContext.Provider 
      value={{
        apiKey,
        apiSecret,
        hasKeys: !!apiKey && !!apiSecret,
        saveKeys,
        clearKeys
      }}
    >
      {children}
    </ApiKeysContext.Provider>
  );
}
