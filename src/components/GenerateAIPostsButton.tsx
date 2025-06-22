
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot } from 'lucide-react';

const GenerateAIPostsButton = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const generateAIPosts = async () => {
    setIsGenerating(true);
    try {
      // Call the generate-social-posts edge function
      const { data, error } = await supabase.functions.invoke('generate-social-posts');

      if (error) {
        console.error('Error generating AI posts:', error);
        toast({
          title: 'Error',
          description: 'Could not generate AI posts.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success!',
          description: 'AI posts generated successfully!'
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
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button onClick={generateAIPosts} variant="outline" disabled={isGenerating}>
      <Bot className="h-4 w-4 mr-2" />
      {isGenerating ? 'Generating...' : 'Generate AI Posts'}
    </Button>
  );
};

export default GenerateAIPostsButton;
