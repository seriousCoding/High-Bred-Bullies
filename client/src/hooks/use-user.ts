import { useState, useEffect } from 'react';
import { useToast } from './use-toast';

// Simple user management hook for tracking user ID and login state
export function useUser() {
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { toast } = useToast();

  // Initialize user from localStorage on component mount
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      try {
        const parsedUserId = parseInt(storedUserId);
        setUserId(parsedUserId);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Error parsing stored user ID:', error);
        localStorage.removeItem('userId');
      }
    }
  }, []);

  // Set user ID and update local storage
  const login = (newUserId: number) => {
    if (newUserId <= 0) {
      toast({
        title: 'Invalid User ID',
        description: 'User ID must be a positive number',
        variant: 'destructive',
      });
      return;
    }

    localStorage.setItem('userId', newUserId.toString());
    setUserId(newUserId);
    setIsLoggedIn(true);
    
    toast({
      title: 'Login Successful',
      description: `Logged in with User ID: ${newUserId}`,
    });
  };

  // Clear user data
  const logout = () => {
    localStorage.removeItem('userId');
    setUserId(null);
    setIsLoggedIn(false);
    
    toast({
      title: 'Logged Out',
      description: 'You have been logged out',
    });
  };

  return {
    userId,
    isLoggedIn,
    login,
    logout
  };
}