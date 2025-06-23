import { useState, useEffect } from 'react';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useUserOnboarding() {
  const { user } = useAuth();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isPetOwner, setIsPetOwner] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const createUserProfile = async () => {
    if (!user) return null;
    
    try {
      // Check if profile exists
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const existingProfile = response.ok ? await response.json() : null;
      
      if (existingProfile) {
        console.log('Found existing profile:', existingProfile);
        return existingProfile;
      }
      
      // Create profile if it doesn't exist
      const username = user.username?.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
      const createResponse = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          first_name: user.username || 'User',
          last_name: '',
        }),
      });
      
      if (!createResponse.ok) throw new Error('Failed to create profile');
      const newProfile = await createResponse.json();
      

      console.log('Created new profile:', newProfile);
      return newProfile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  };

  const checkPetOwnerStatus = async () => {
    if (!user) return false;
    
    try {
      console.log('Checking pet owner status for user:', user.id);
      
      // First check if user already has a pet owner profile
      const token = localStorage.getItem('auth_token');
      const petOwnerResponse = await fetch(`${API_BASE_URL}/api/user/pet-owner-status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const existingPetOwner = petOwnerResponse.ok ? await petOwnerResponse.json() : null;
      
      console.log('Existing pet owner check:', { existingPetOwner });
      
      if (existingPetOwner) {
        console.log('User is already a pet owner');
        return true;
      }
      
      // Check if user has any paid orders (the correct status from finalize-litter-order)
      const ordersResponse = await fetch(`${API_BASE_URL}/api/user/orders?status=paid`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const paidOrders = ordersResponse.ok ? await ordersResponse.json() : []; // Changed from 'completed' to 'paid'
      
      console.log('Paid orders check:', { paidOrders });
      
      if (paidOrders && paidOrders.length > 0) {
        console.log('User has paid orders, creating pet owner profile');
        
        // Create pet owner profile since they have paid orders
        const createPetOwnerResponse = await fetch(`${API_BASE_URL}/api/user/pet-owner`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adoption_date: new Date().toISOString().split('T')[0]
          }),
        });
        
        if (!createPetOwnerResponse.ok) throw new Error('Failed to create pet owner profile');
        const newPetOwner = await createPetOwnerResponse.json();
        

        
        console.log('Created pet owner profile:', newPetOwner);
        toast.success('Welcome to High Table! Your exclusive community access has been unlocked.');
        return true;
      }
      
      console.log('User is not a pet owner');
      return false;
    } catch (error) {
      console.error('Error checking pet owner status:', error);
      return false;
    }
  };

  const initializeUser = async () => {
    if (!user) {
      console.log('No user, skipping initialization');
      return;
    }
    
    console.log('Starting user initialization for:', user.username);
    setIsOnboarding(true);
    
    try {
      // Step 1: Ensure user profile exists
      const profile = await createUserProfile();
      if (!profile) {
        console.error('Failed to create user profile');
        toast.error('Failed to create user profile');
        return;
      }
      console.log('Profile set:', profile);
      setUserProfile(profile);
      
      // Step 2: Check if user qualifies for High Table access
      const isOwner = await checkPetOwnerStatus();
      console.log('Pet owner status:', isOwner);
      setIsPetOwner(isOwner);
      
      console.log('User initialization complete');
      setIsReady(true);
    } catch (error) {
      console.error('Error during user initialization:', error);
      toast.error('Failed to initialize user profile');
    } finally {
      setIsOnboarding(false);
    }
  };

  useEffect(() => {
    if (user && !isReady && !isOnboarding) {
      console.log('Triggering user initialization');
      initializeUser();
    }
    // Add timeout fallback to prevent infinite loading
    const timeout = setTimeout(() => {
      if (user && !isReady && !isOnboarding) {
        console.log('Timeout reached, setting ready state to prevent infinite loading');
        setIsReady(true);
        setIsOnboarding(false);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [user, isReady, isOnboarding]);

  console.log('useUserOnboarding state:', {
    user: !!user,
    userProfile: !!userProfile,
    isPetOwner,
    isReady,
    isOnboarding
  });

  return {
    userProfile,
    isPetOwner,
    isOnboarding,
    isReady,
    refreshProfile: initializeUser
  };
}
