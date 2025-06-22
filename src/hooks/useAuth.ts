
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface User {
  id: number;
  username: string;
  hasApiKeys?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true
  });

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token and get user info
      fetchCurrentUser(token);
    } else {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const fetchCurrentUser = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const user = await response.json();
        setAuthState({
          user,
          token,
          loading: false
        });
      } else {
        // Invalid token, remove it
        localStorage.removeItem('auth_token');
        setAuthState({
          user: null,
          token: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      localStorage.removeItem('auth_token');
      setAuthState({
        user: null,
        token: null,
        loading: false
      });
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to sign in');
      }

      // Store token and update state
      localStorage.setItem('auth_token', data.token);
      setAuthState({
        user: data,
        token: data.token,
        loading: false
      });

      toast.success('Successfully signed in!');
      return { data, error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      return { data: null, error };
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create account');
      }

      // Store token and update state
      localStorage.setItem('auth_token', data.token);
      setAuthState({
        user: data,
        token: data.token,
        loading: false
      });

      toast.success('Account created successfully!');
      return { data, error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || 'Failed to create account');
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Attempting to sign out...');
      
      // Call logout endpoint (optional, since JWT is stateless)
      if (authState.token) {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      // Clear local storage and state
      localStorage.removeItem('auth_token');
      setAuthState({
        user: null,
        token: null,
        loading: false
      });
      
      toast.success('Successfully signed out!');
      
      // Redirect to home page
      window.location.href = '/';
      
      return { error: null };
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(error.message || 'Failed to sign out');
      return { error };
    }
  };

  return {
    user: authState.user,
    session: authState.token ? { access_token: authState.token } : null,
    loading: authState.loading,
    signIn,
    signUp,
    signOut,
  };
}
