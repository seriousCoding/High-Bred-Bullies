
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bot } from 'lucide-react';

const GenerateAIPostsButton = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const generateAIPosts = async () => {
    setIsGenerating(true);
    try {
      const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/generate-social-posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI posts');
      }

      const data = await response.json();
      
      toast({
        title: 'Success!',
        description: 'AI posts generated successfully!'
      });
      // Refresh the page to show new posts
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Could not generate AI posts.',
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
