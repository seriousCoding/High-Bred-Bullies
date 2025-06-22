import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (existingProfile) {
        console.log('Found existing profile:', existingProfile);
        return existingProfile;
      }
      
      // Create profile if it doesn't exist
      const username = user.email?.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6);
      const { data: newProfile, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          username,
          first_name: user.user_metadata?.first_name || 'User',
          last_name: user.user_metadata?.last_name || '',
        })
        .select()
        .single();
      
      if (error) throw error;
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
      const { data: existingPetOwner, error: petOwnerError } = await supabase
        .from('pet_owners')
        .select('id, created_at')
        .eq('user_id', user.id)
        .single();
      
      console.log('Existing pet owner check:', { existingPetOwner, petOwnerError });
      
      if (existingPetOwner) {
        console.log('User is already a pet owner');
        return true;
      }
      
      // Check if user has any paid orders (the correct status from finalize-litter-order)
      const { data: paidOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'paid'); // Changed from 'completed' to 'paid'
      
      console.log('Paid orders check:', { paidOrders, ordersError });
      
      if (paidOrders && paidOrders.length > 0) {
        console.log('User has paid orders, creating pet owner profile');
        
        // Create pet owner profile since they have paid orders
        const { data: newPetOwner, error: createError } = await supabase
          .from('pet_owners')
          .insert({
            user_id: user.id,
            adoption_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating pet owner profile:', createError);
          return false;
        }
        
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
    
    console.log('Starting user initialization for:', user.email);
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
