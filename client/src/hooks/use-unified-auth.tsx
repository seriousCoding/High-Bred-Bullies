import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  authenticated: boolean;
  authType: 'api_key' | 'oauth' | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  
  // Auth actions
  loginWithOAuth: () => void;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
  
  // User data
  profile: any;
  wallets: any[];
  fetchWallets: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function UnifiedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  
  const { toast } = useToast();

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus()
      .finally(() => setIsLoading(false));
  }, []);

  // Check if user is authenticated with the server
  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const response = await apiRequest('GET', '/api/auth-status');
      const data = await response.json();
      
      if (data.authenticated) {
        setUser({
          authenticated: true,
          authType: data.authType
        });
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user profile from Coinbase
  const fetchProfile = async (): Promise<void> => {
    if (!user?.authenticated) return;
    
    try {
      const response = await apiRequest('GET', '/api/user-profile');
      const data = await response.json();
      
      if (data.data) {
        setProfile(data.data);
        
        // Update user with profile info
        setUser(prev => prev ? {
          ...prev,
          id: data.data.id,
          name: data.data.name,
          email: data.data.email
        } : null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error fetching profile',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };

  // Fetch wallets (accounts) from Coinbase
  const fetchWallets = async (): Promise<void> => {
    if (!user?.authenticated) return;
    
    try {
      const response = await apiRequest('GET', '/api/wallets');
      const data = await response.json();
      
      if (data.data) {
        setWallets(data.data);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
      toast({
        title: 'Error fetching wallets',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };

  // Login with OAuth by redirecting to Coinbase login
  const loginWithOAuth = () => {
    window.location.href = '/auth/login';
  };

  // Logout by calling the server endpoint
  const logout = async (): Promise<void> => {
    try {
      await apiRequest('POST', '/api/logout');
      
      // Reset user state
      setUser(null);
      setProfile(null);
      setWallets([]);
      
      toast({
        title: 'Logged out successfully',
        description: 'You have been logged out of your Coinbase account.',
      });
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: 'Error logging out',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginWithOAuth,
        logout,
        checkAuthStatus,
        profile,
        wallets,
        fetchWallets,
        fetchProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useUnifiedAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useUnifiedAuth must be used within an UnifiedAuthProvider');
  }
  
  return context;
}