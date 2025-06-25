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
      // For authenticated breeders, create a simple fallback profile
      const fallbackProfile = {
        id: `profile_${user.id}`,
        user_id: user.id,
        username: user.username,
        first_name: user.username || 'User',
        last_name: '',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Created fallback profile for authenticated user:', fallbackProfile);
      return fallbackProfile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  };

  const checkPetOwnerStatus = async () => {
    if (!user) return false;
    
    try {
      console.log('Checking pet owner status for user:', user.id);
      
      // For authenticated breeders, assume they have High Table access
      if (user.isBreeder) {
        console.log('User is a breeder, granting High Table access');
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
      // Don't show error toast for authentication failures, just log and continue
      console.log('Setting ready state despite initialization error to prevent loading loop');
      setIsReady(true);
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
