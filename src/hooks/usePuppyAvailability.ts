
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

export const usePuppyAvailability = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const makePuppyAvailableMutation = useMutation({
    mutationFn: async (puppyId: string) => {
      if (!user) {
        throw new Error("You must be logged in to perform this action.");
      }

      const token = localStorage.getItem('token');
      
      // Make the puppy available and handle order cancellation server-side
      const response = await fetch(`${API_BASE_URL}/api/puppies/${puppyId}/make-available`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to make puppy available');
      }

      return await response.json();
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
