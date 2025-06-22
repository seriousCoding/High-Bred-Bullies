import { useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

const API_BASE_URL = 'http://localhost:5000';

export function useSimpleAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
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
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.token && data.user) {
        localStorage.setItem('auth_token', data.token);
        setAuthState({
          user: data.user,
          token: data.token,
          loading: false,
        });
        return { success: true, error: null };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, loading: false }));
      return { success: false, error: error.message };
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.token && data.user) {
        localStorage.setItem('auth_token', data.token);
        setAuthState({
          user: data.user,
          token: data.token,
          loading: false,
        });
        return { success: true, error: null };
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, loading: false }));
      return { success: false, error: error.message };
    }
  };

  const signOut = () => {
    localStorage.removeItem('auth_token');
    setAuthState({
      user: null,
      token: null,
      loading: false,
    });
  };

  return {
    user: authState.user,
    token: authState.token,
    loading: authState.loading,
    signIn,
    signUp,
    signOut,
  };
}