
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export const usePuppyAvailability = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const makePuppyAvailableMutation = useMutation({
    mutationFn: async (puppyId: string) => {
      if (!session) {
        throw new Error("You must be logged in to perform this action.");
      }

      // First, check if this puppy has any active orders
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          orders!inner(status, id)
        `)
        .eq('puppy_id', puppyId);

      if (orderItemsError) throw orderItemsError;

      // Find active orders (not cancelled or archived)
      const activeOrders = orderItems?.filter(item => 
        item.orders && !['cancelled', 'archived'].includes(item.orders.status)
      );

      // If there are active orders, cancel them first
      if (activeOrders && activeOrders.length > 0) {
        for (const orderItem of activeOrders) {
          const { data, error } = await supabase.functions.invoke('cancel-order', {
            body: { order_id: orderItem.order_id },
            headers: { Authorization: `Bearer ${session.access_token}` }
          });

          if (error) throw new Error(`Failed to cancel order: ${error.message}`);
          if (data.error) throw new Error(`Failed to cancel order: ${data.error}`);
        }
      }

      // Make the puppy available
      const { error: puppyError } = await supabase
        .from('puppies')
        .update({ 
          is_available: true, 
          sold_to: null, 
          reserved_by: null 
        })
        .eq('id', puppyId);

      if (puppyError) throw puppyError;

      return { cancelledOrders: activeOrders?.length || 0 };
    },
    onSuccess: (data) => {
      const message = data.cancelledOrders > 0 
        ? `Puppy is now available. ${data.cancelledOrders} order(s) have been cancelled.`
        : "Puppy is now available.";
      toast.success(message);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['litters'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminArchivedOrders'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to make puppy available: ${error.message}`);
    }
  });

  return {
    makePuppyAvailable: makePuppyAvailableMutation.mutate,
    isLoading: makePuppyAvailableMutation.isPending
  };
};
