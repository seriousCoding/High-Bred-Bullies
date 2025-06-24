
import React from 'react';
import { SocialPost } from '@/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, UserPlus, Star, Share, Lock, Globe, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import SocialShareButtons from './SocialShareButtons';
import { useAuth } from '@/hooks/useAuth';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
import { toast } from 'sonner';

interface PostCardProps {
  post: SocialPost;
  onLike: (postId: string) => void;
  onFollow: (profileId: string) => void;
  onDelete?: (postId: string) => void;
  currentProfileId: string | undefined;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onFollow, onDelete, currentProfileId }) => {
  const { user } = useAuth();
  const { userProfile } = useUserOnboarding();
  const userInitial = post.first_name?.charAt(0) || 'U';

  const handleFollow = () => {
    if (post.user_id) {
        onFollow(post.user_id);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/social-posts/${post.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete post: ${response.statusText}`);
      }
      
      toast.success('Post deleted successfully');
      if (onDelete) onDelete(post.id);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const postUrl = `${window.location.origin}/high-table#post-${post.id}`;
  const shareText = `Check out this post: ${post.title}`;

  // Check if this is the user's own post or if user is admin
  const isOwnPost = currentProfileId && post.user_id === currentProfileId;
  const isAdmin = userProfile?.is_admin;
  const canDelete = isOwnPost || isAdmin;

  // Enhanced function to determine if URL is a video
  const isVideoUrl = (url: string) => {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    // Check for video file extensions
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
      return true;
    }
    
    // Check for video hosting domains or video keywords
    const videoIndicators = [
      'video',
      'gtv-videos-bucket',
      'sample-videos.com',
      'learningcontainer.com/wp-content/uploads',
      'commondatastorage.googleapis.com/gtv-videos-bucket'
    ];
    
    return videoIndicators.some(indicator => lowerUrl.includes(indicator));
  };

  return (
    <Card id={`post-${post.id}`}>
      <CardHeader className="flex flex-row items-center gap-4 p-4">
        <Avatar>
          <AvatarImage src={post.avatar_url || undefined} alt={post.username || 'User avatar'} />
          <AvatarFallback>{userInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-grow">
          <div className="flex items-center gap-2">
            <p className="font-bold">{post.first_name} {post.last_name}</p>
            {post.is_testimonial && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                Testimonial
              </Badge>
            )}
            <Badge 
              variant={post.visibility === 'private' ? "outline" : "secondary"} 
              className="text-xs flex items-center gap-1"
            >
              {post.visibility === 'private' ? (
                <>
                  <Lock className="h-3 w-3" />
                  Private
                </>
              ) : (
                <>
                  <Globe className="h-3 w-3" />
                  Public
                </>
              )}
            </Badge>
            {isOwnPost && post.visibility === 'private' && (
              <Badge variant="outline" className="text-xs bg-blue-50">
                Only you can see this
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            @{post.username} &middot; {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentProfileId && post.user_id && currentProfileId !== post.user_id && (
               <Button variant="outline" size="sm" onClick={handleFollow}>
                  <UserPlus className="h-4 w-4 mr-2" /> Follow
               </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
        <p className="text-muted-foreground">{post.content}</p>
        {post.image_url && (
          <div className="mt-4">
            {isVideoUrl(post.image_url) ? (
              <video 
                src={post.image_url} 
                controls 
                className="rounded-lg w-full object-cover"
                style={{ maxHeight: '400px' }}
                preload="metadata"
                onError={(e) => {
                  console.error('Video failed to load:', post.image_url);
                  // Fallback to show as image if video fails
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                  const fallbackImg = document.createElement('img');
                  fallbackImg.src = post.image_url;
                  fallbackImg.alt = post.title;
                  fallbackImg.className = 'rounded-lg w-full object-cover';
                  target.parentNode?.appendChild(fallbackImg);
                }}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <img 
                src={post.image_url} 
                alt={post.title || 'Post image'} 
                className="rounded-lg w-full object-cover" 
                style={{ maxHeight: '400px' }}
                loading="lazy"
                onError={(e) => {
                  console.error('Image failed to load:', post.image_url);
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onLike(post.id)} className="flex items-center gap-2 text-muted-foreground hover:text-red-500">
            <Heart className={`h-5 w-5 ${post.is_liked_by_user ? 'text-red-500 fill-current' : ''}`} />
            <span>{post.likes_count || 0}</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            <span>{post.comments_count || 0} Comments</span>
          </Button>
        </div>
        {post.visibility === 'public' && (
          <SocialShareButtons 
            url={postUrl}
            title={post.title}
            text={shareText}
          />
        )}
      </CardFooter>
    </Card>
  );
};

export default PostCard;
