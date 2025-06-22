
import React from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface SocialShareButtonsProps {
  url: string;
  title: string;
  text: string;
}

const SocialShareButtons: React.FC<SocialShareButtonsProps> = ({ url, title, text }) => {
  const handleShare = async () => {
    // Check if Web Share API is supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: url,
        });
        toast.success('Post shared successfully!');
      } catch (error) {
        console.error('Error sharing:', error);
        // Fallback to copy URL
        handleCopyUrl();
      }
    } else {
      // Fallback to copy URL
      handleCopyUrl();
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleShare}
        className="flex items-center gap-2 text-muted-foreground hover:text-blue-500"
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleCopyUrl}
        className="flex items-center gap-2 text-muted-foreground hover:text-blue-500"
      >
        <Copy className="h-4 w-4" />
        Copy Link
      </Button>
    </div>
  );
};

export default SocialShareButtons;
