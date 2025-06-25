
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

      const response = await fetch(`${API_BASE_URL}/api/social-posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ posts: samplePosts })
      });

      if (!response.ok) {
        console.error('Error creating sample posts:', response.statusText);
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
