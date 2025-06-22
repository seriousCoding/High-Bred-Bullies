
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useOrderCompletion = () => {
  useEffect(() => {
    const handleOrderStatusChange = async (payload: any) => {
      if (payload.new.status === 'completed' && payload.old.status !== 'completed') {
        // Order just completed, create pet owner profile
        try {
          await supabase.functions.invoke('create-pet-owner-profile', {
            body: { 
              userId: payload.new.user_id,
              puppyId: null // Will be populated from order items
            }
          });
        } catch (error) {
          console.error('Error creating pet owner profile:', error);
        }
      }
    };

    const channel = supabase
      .channel('order-status-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: 'status=eq.completed'
      }, handleOrderStatusChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
