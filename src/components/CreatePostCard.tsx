
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
const API_BASE_URL = window.location.origin;
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, Lock, Upload, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface CreatePostCardProps {
  userProfileId: string;
  onPostCreated?: () => void;
}

const CreatePostCard: React.FC<CreatePostCardProps> = ({ userProfileId, onPostCreated }) => {
  const { user } = useAuth();
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    visibility: 'public' as 'public' | 'private',
    is_testimonial: false
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewPost({ ...newPost, [e.target.name]: e.target.value });
  };

  const handleTestimonialChange = (checked: boolean) => {
    setNewPost({ ...newPost, is_testimonial: checked });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type and size
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
      const maxSize = 50 * 1024 * 1024; // 50MB

      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image or video file');
        return;
      }

      if (file.size > maxSize) {
        toast.error('File size must be less than 50MB');
        return;
      }

      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `social-posts/${fileName}`;

      // File upload would need to be implemented on the backend
      // For now, we'll create a placeholder URL
      const uploadUrl = `/uploads/${fileName}`;
      console.log('File upload needed for:', filePath);
      
      return uploadUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim()) {
      toast.error('Please add a title for your post');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to create a post');
      return;
    }

    setIsSubmitting(true);

    try {
      let mediaUrl = null;
      
      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile);
        if (!mediaUrl) {
          toast.error('Failed to upload media file');
          setIsSubmitting(false);
          return;
        }
      }

      console.log('Creating post with data:', {
        ...newPost,
        user_id: user.id,
        image_url: mediaUrl,
        moderation_status: 'approved'
      });

      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/social-posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newPost.title,
          content: newPost.content,
          visibility: newPost.visibility,
          is_testimonial: newPost.is_testimonial,
          image_url: mediaUrl,
          moderation_status: 'approved'
        }),
      });

      if (!response.ok) {
        console.error('Post creation error:', response.statusText);
        throw new Error('Failed to create post');
      }

      const postData = await response.json();

      console.log('Post created successfully:', postData);
      toast.success('Your post has been shared successfully!');
      
      // Reset form
      setNewPost({ title: '', content: '', visibility: 'public', is_testimonial: false });
      setSelectedFile(null);
      setFilePreview(null);
      
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      onPostCreated?.();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(`Could not create post: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Share an Update</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            name="title" 
            placeholder="What's happening with your pet?" 
            value={newPost.title} 
            onChange={handleInputChange} 
            required 
          />
          <Textarea 
            name="content" 
            placeholder="Share your story, experience, or ask for advice..." 
            value={newPost.content} 
            onChange={handleInputChange}
            rows={3}
          />
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="media-upload" className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-md text-sm border">
                <Upload className="h-4 w-4" />
                Add Photo/Video
              </label>
              <input
                id="media-upload"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            
            {filePreview && (
              <div className="relative inline-block">
                {selectedFile?.type.startsWith('video/') ? (
                  <video 
                    src={filePreview} 
                    controls 
                    className="max-w-xs rounded-lg"
                    style={{ maxHeight: '200px' }}
                  />
                ) : (
                  <img 
                    src={filePreview} 
                    alt="Preview" 
                    className="max-w-xs rounded-lg"
                    style={{ maxHeight: '200px' }}
                  />
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={removeFile}
                  className="absolute top-2 right-2"
                >
                  ×
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Select 
              value={newPost.visibility} 
              onValueChange={(value: 'public' | 'private') => 
                setNewPost({ ...newPost, visibility: value })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Public
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Private
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="testimonial"
                checked={newPost.is_testimonial}
                onCheckedChange={handleTestimonialChange}
              />
              <label htmlFor="testimonial" className="text-sm cursor-pointer">
                This is a testimonial/review
              </label>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-green-50 p-2 rounded">
            Posts are auto-approved and will appear immediately in the community feed
          </div>
          <Button type="submit" disabled={isSubmitting || !newPost.title.trim()}>
            {isSubmitting ? 'Posting...' : 'Share Post'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatePostCard;
