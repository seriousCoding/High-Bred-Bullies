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
      console.log("Exchanging code for token with redirect URI:", REDIRECT_URI);
      
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
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("Token exchange failed:", data);
        throw new Error(data.message || "Failed to exchange code for token");
      }
      
      console.log("Token exchange successful, received tokens");
      
      saveTokens(
        data.access_token,
        data.refresh_token,
        data.expires_in,
        true // Always remember OAuth tokens
      );
      
      // Redirect to home page after successful login
      window.history.replaceState({}, document.title, "/");
    } catch (error) {
      console.error("Error exchanging code for token:", error);
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
  const initiateOAuthFlow = () => {
    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem(OAUTH_STATE_KEY, state);
    
    // Build authorization URL
    const authUrl = new URL("https://login.coinbase.com/oauth2/auth");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("scope", "wallet:accounts:read,wallet:user:read,wallet:buys:read,wallet:sells:read,wallet:transactions:read,wallet:payment-methods:read,wallet:addresses:read,wallet:orders:read,wallet:orders:create,wallet:orders:update,wallet:trades:read,offline_access");
    
    // Redirect user to authorization page
    window.location.href = authUrl.toString();
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
