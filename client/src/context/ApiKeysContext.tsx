import * as React from "react";

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // timestamp when the token expires
  isAuthenticated: boolean;
  saveTokens: (accessToken: string, refreshToken: string, expiresIn: number, remember: boolean) => void;
  logout: () => void;
  initiateOAuthFlow: () => void;
}

export const ApiKeysContext = React.createContext<AuthContextType | null>(null);

interface ApiKeysProviderProps {
  children: React.ReactNode;
}

// OAuth2 configuration
const CLIENT_ID = import.meta.env.VITE_COINBASE_OAUTH_CLIENT_ID || ""; // Should be provided by environment variable
const REDIRECT_URI = window.location.origin + "/auth/callback";
const OAUTH_STATE_KEY = "auth_state_key";

// Debug OAuth configuration
console.log("OAuth client configuration:", {
  client_id_available: !!CLIENT_ID,
  redirect_uri: REDIRECT_URI
});

export function ApiKeysProvider({ children }: ApiKeysProviderProps) {
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [refreshToken, setRefreshToken] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  
  // Load saved tokens from localStorage on initial render
  React.useEffect(() => {
    const savedAccessToken = localStorage.getItem("trading_access_token");
    const savedRefreshToken = localStorage.getItem("trading_refresh_token");
    const savedExpiresAt = localStorage.getItem("trading_expires_at");
    
    if (savedAccessToken && savedRefreshToken && savedExpiresAt) {
      try {
        const expiresAtTimestamp = parseInt(savedExpiresAt, 10);
        
        if (expiresAtTimestamp > Date.now()) {
          // Token is still valid
          setAccessToken(savedAccessToken);
          setRefreshToken(savedRefreshToken);
          setExpiresAt(expiresAtTimestamp);
        } else {
          // Token has expired, should refresh it
          refreshAccessToken(savedRefreshToken);
        }
      } catch (error) {
        console.error("Failed to load auth tokens:", error);
        // Clear potentially corrupted data
        clearTokens();
      }
    }
    
    // Check for OAuth callback response
    checkForOAuthResponse();
  }, []);
  
  // Check if current URL contains OAuth response
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
  
  // Exchange authorization code for access token
  const exchangeCodeForToken = async (authCode: string) => {
    try {
      console.log("---------------------------------------------");
      console.log("CLIENT-SIDE TOKEN EXCHANGE - START");
      console.log("Exchanging code for token with:");
      console.log("- Code length:", authCode.length);
      console.log("- Redirect URI:", REDIRECT_URI);
      console.log("- Client ID available:", !!CLIENT_ID);
      
      const requestBody = {
        code: authCode,
        redirect_uri: REDIRECT_URI
      };
      
      console.log("Request body structure:", JSON.stringify(requestBody, null, 2));
      
      console.log("Making fetch request to /api/oauth/token");
      const response = await fetch("/api/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log("Response status:", response.status, response.statusText);
      
      // Log only important headers to avoid the iteration error
      console.log("Response content-type:", response.headers.get("content-type"));
      
      const data = await response.json();
      console.log("Response body structure:", Object.keys(data));
      
      if (!response.ok) {
        console.error("TOKEN EXCHANGE FAILED");
        console.error("Error details:", JSON.stringify(data, null, 2));
        throw new Error(data.message || "Failed to exchange code for token");
      }
      
      console.log("TOKEN EXCHANGE SUCCESSFUL");
      console.log("Received tokens with properties:", {
        access_token_length: data.access_token ? data.access_token.length : 0,
        refresh_token_length: data.refresh_token ? data.refresh_token.length : 0,
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: data.scope
      });
      
      saveTokens(
        data.access_token,
        data.refresh_token,
        data.expires_in,
        true // Always remember OAuth tokens
      );
      
      console.log("Tokens saved successfully");
      console.log("Redirecting to home page");
      console.log("---------------------------------------------");
      
      // Redirect to home page after successful login
      window.history.replaceState({}, document.title, "/");
    } catch (error) {
      console.error("---------------------------------------------");
      console.error("TOKEN EXCHANGE ERROR");
      console.error("Error exchanging code for token:", error);
      console.error("---------------------------------------------");
    }
  };
  
  // Refresh access token using refresh token
  const refreshAccessToken = async (token: string) => {
    try {
      const response = await fetch("/api/oauth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          refresh_token: token
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }
      
      const data = await response.json();
      saveTokens(
        data.access_token,
        data.refresh_token || token, // Use new refresh token if provided
        data.expires_in,
        true
      );
    } catch (error) {
      console.error("Error refreshing token:", error);
      clearTokens();
    }
  };
  
  // Save auth tokens
  const saveTokens = (
    token: string, 
    refresh: string, 
    expiresIn: number, 
    remember: boolean
  ) => {
    const expirationTime = Date.now() + expiresIn * 1000;
    
    setAccessToken(token);
    setRefreshToken(refresh);
    setExpiresAt(expirationTime);
    
    if (remember) {
      localStorage.setItem("trading_access_token", token);
      localStorage.setItem("trading_refresh_token", refresh);
      localStorage.setItem("trading_expires_at", expirationTime.toString());
    }
  };
  
  // Clear auth tokens
  const clearTokens = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setExpiresAt(null);
    localStorage.removeItem("trading_access_token");
    localStorage.removeItem("trading_refresh_token");
    localStorage.removeItem("trading_expires_at");
  };
  
  // Initiate OAuth login flow
  const initiateOAuthFlow = async () => {
    try {
      console.log("---------------------------------------------");
      console.log("INITIATING OAUTH CONNECTION FROM MODAL");
      console.log("Using server-side proxy for OAuth initialization");
      console.log("Redirect URI:", REDIRECT_URI);
      
      // First get the OAuth URL from the server
      const response = await fetch(`/api/oauth/init?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server OAuth initialization failed:", errorData);
        throw new Error(errorData.message || "Failed to initialize OAuth flow");
      }
      
      const data = await response.json();
      console.log("Received OAuth URL and state from server");
      
      // We have two options for OAuth flow:
      
      // Option 1: Using server-side proxy for the request
      const useProxy = true; // Toggle this to try different approaches
      
      if (useProxy) {
        try {
          // Make a proxy request through our server to bypass CORS/connection issues
          console.log("Attempting to use server-side proxy to connect to Coinbase");
          const proxyResponse = await fetch(`/api/oauth/proxy?auth_url=${encodeURIComponent(data.auth_url)}`);
          
          if (!proxyResponse.ok) {
            throw new Error(`Proxy request failed with status: ${proxyResponse.status}`);
          }
          
          const proxyData = await proxyResponse.json();
          
          if (proxyData.redirect_url) {
            console.log("Received redirect URL from proxy, redirecting to:", proxyData.redirect_url);
            // Store state for CSRF protection
            localStorage.setItem("auth_state_key", data.state);
            // Redirect to the URL obtained from the proxy
            window.location.href = proxyData.redirect_url;
            return;
          }
        } catch (proxyError) {
          console.error("Proxy approach failed:", proxyError);
          console.log("Falling back to HTML redirect page approach");
        }
      }
      
      // Option 2: Using our HTML redirect page (fallback)
      console.log("STARTING COINBASE OAUTH CONNECTION FLOW VIA HTML REDIRECT PAGE");
      console.log("Will redirect to:", REDIRECT_URI);
      
      // Instead of directly redirecting to Coinbase (which might be blocked),
      // redirect to our server-side HTML page that will handle the Coinbase redirect
      const redirectUrl = `/auth/redirect?auth_url=${encodeURIComponent(data.auth_url)}&state=${encodeURIComponent(data.state)}`;
      
      console.log("Redirecting to intermediary HTML page:", redirectUrl);
      
      // Redirect to our HTML page which will then redirect to Coinbase
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("---------------------------------------------");
      console.error("OAUTH INITIALIZATION ERROR:");
      console.error(error);
      console.error("---------------------------------------------");
      throw error; // Re-throw so the component can handle it
    }
  };
  
  return (
    <ApiKeysContext.Provider 
      value={{
        accessToken,
        refreshToken,
        expiresAt,
        isAuthenticated: !!accessToken && !!expiresAt && expiresAt > Date.now(),
        saveTokens,
        logout: clearTokens,
        initiateOAuthFlow
      }}
    >
      {children}
    </ApiKeysContext.Provider>
  );
}
