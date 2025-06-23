
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface User {
  id: number;
  username: string;
  isBreeder?: boolean;
  fullName?: string;
  hasApiKeys?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

// Use relative URLs when running on Replit, localhost for local development
const API_BASE_URL = window.location.hostname.includes('replit.dev') ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

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
      console.log('fetchCurrentUser: Fetching user with token:', token.substring(0, 20) + '...');
      const response = await fetch(`${API_BASE_URL}/api/auth/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('fetchCurrentUser: Response status:', response.status);
      
      if (response.ok) {
        const user = await response.json();
        console.log('fetchCurrentUser: User data received:', user);
        setAuthState({
          user,
          token,
          loading: false
        });
        console.log('fetchCurrentUser: Auth state updated with user');
      } else {
        console.log('fetchCurrentUser: Invalid token, removing from storage');
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
      const loginUrl = `${API_BASE_URL}/api/login`;
      console.log('Attempting login to:', loginUrl);
      console.log('Login payload:', { username, password: '***' });
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      console.log('Login response status:', response.status);
      console.log('Login response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Invalid response from server');
      }
      
      console.log('Parsed login response data:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to sign in');
      }

      // Validate response structure
      if (!data.token || !data.user) {
        console.error('Invalid login response structure:', data);
        throw new Error('Invalid login response from server');
      }

      // Store token and update state
      localStorage.setItem('auth_token', data.token);
      console.log('Login successful, updating auth state with user:', data.user);
      
      setAuthState({
        user: data.user,
        token: data.token,
        loading: false
      });

      // Immediately fetch current user to ensure state persistence
      setTimeout(() => {
        fetchCurrentUser(data.token);
      }, 100);

      toast.success('Successfully signed in!');
      return { data, error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage = error.message || error.toString() || 'Failed to sign in';
      toast.error(`Login failed: ${errorMessage}`);
      return { data: null, error };
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      const registerUrl = `${API_BASE_URL}/api/register`;
      console.log('Attempting registration to:', registerUrl);
      console.log('Registration payload:', { username, password: '***' });
      
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      console.log('Registration response status:', response.status);
      console.log('Registration response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Raw registration response text:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse registration response as JSON:', parseError);
        throw new Error('Invalid response from server');
      }
      
      console.log('Parsed registration response data:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create account');
      }

      // Validate response structure
      if (!data.token || !data.user) {
        console.error('Invalid registration response structure:', data);
        throw new Error('Invalid registration response from server');
      }

      // Store token and update state
      localStorage.setItem('auth_token', data.token);
      console.log('Registration successful, updating auth state with user:', data.user);
      
      setAuthState({
        user: data.user,
        token: data.token,
        loading: false
      });

      toast.success('Account created successfully!');
      return { data, error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      const errorMessage = error.message || error.toString() || 'Failed to create account';
      toast.error(`Registration failed: ${errorMessage}`);
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
