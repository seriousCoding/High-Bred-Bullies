
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

const CreateSamplePostsButton = () => {
  const { toast } = useToast();

  const createSamplePosts = async () => {
    try {
      // Create sample posts directly in the social_posts table with approved status
      const samplePosts = [
        {
          user_id: null,
          title: 'Welcome to High Table Community!',
          content: 'This is a sample post to showcase our community. Share your pet stories and connect with other pet owners!',
          visibility: 'public' as const,
          moderation_status: 'approved' as const,
          is_testimonial: false
        },
        {
          user_id: null,
          title: 'Tips for New Puppy Parents',
          content: 'Bringing home a new puppy? Here are some essential tips: establish a routine, start training early, and socialize your puppy with different people and environments.',
          visibility: 'public' as const,
          moderation_status: 'approved' as const,
          is_testimonial: false
        },
        {
          user_id: null,
          title: 'Amazing Breeder Experience!',
          content: 'I had such a wonderful experience with my breeder. The puppy is healthy, well-socialized, and exactly what I was looking for. Highly recommend working with reputable breeders!',
          visibility: 'public' as const,
          moderation_status: 'approved' as const,
          is_testimonial: true
        }
      ];

      const { error } = await supabase
        .from('social_posts')
        .insert(samplePosts);

      if (error) {
        console.error('Error creating sample posts:', error);
        toast({
          title: 'Error',
          description: 'Could not create sample posts.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success!',
          description: 'Sample posts created successfully!'
        });
        // Refresh the page to show new posts
        window.location.reload();
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Button onClick={createSamplePosts} variant="outline">
      <Plus className="h-4 w-4 mr-2" />
      Create Sample Posts
    </Button>
  );
};

export default CreateSamplePostsButton;
