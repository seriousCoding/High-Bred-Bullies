import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SocialPost {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  visibility: 'public' | 'private';
  moderation_status: 'pending' | 'approved' | 'rejected';
  is_testimonial: boolean;
  created_at: string;
  user_id: string;
  user_profiles?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  };
}

const fetchSocialPosts = async () => {
  const response = await fetch(`${API_BASE_URL}/api/admin/social-posts`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch social posts');
  }

  const posts = await response.json();
  
  // Filter out posts with null or invalid user_ids and get unique valid user_ids
  const validUserIds = [...new Set(
    posts
      .filter(post => post.user_id && post.user_id !== 'null' && post.user_id.trim() !== '')
      .map(post => post.user_id)
  )];
  
  let profileMap = new Map();
  
  // Only fetch profiles if we have valid user IDs
  if (validUserIds.length > 0) {
    const profileResponse = await fetch(`${API_BASE_URL}/api/user-profiles/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({ userIds: validUserIds })
    });

    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      // Create a map of user_id to profile
      profiles?.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });
    } else {
      console.error('Error fetching user profiles');
      // Continue without profiles rather than failing completely
    }
  }

  // Combine posts with their user profiles
  const postsWithProfiles = posts.map(post => ({
    ...post,
    user_profiles: post.user_id && post.user_id !== 'null' ? profileMap.get(post.user_id) : undefined
  }));

  return postsWithProfiles as SocialPost[];
};

export const AdminSocialPosts = () => {
  const queryClient = useQueryClient();
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['adminSocialPosts'],
    queryFn: fetchSocialPosts,
  });

  const moderatePostMutation = useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: 'approved' | 'rejected' }) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-posts/${postId}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ moderation_status: status })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update post moderation status');
      }
    },
    onSuccess: () => {
      toast.success("Post moderation status updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['adminSocialPosts'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update post: ${error.message}`);
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/social-posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete post');
      }
    },
    onSuccess: () => {
      toast.success("Post deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ['adminSocialPosts'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete post: ${error.message}`);
    }
  });

  const handleModeratePost = (postId: string, status: 'approved' | 'rejected') => {
    moderatePostMutation.mutate({ postId, status });
  };

  const handleDeletePost = (postId: string) => {
    deletePostMutation.mutate(postId);
  };

  const handleViewPost = (post: SocialPost) => {
    setSelectedPost(post);
    setViewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Fetching Social Posts</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Manage Social Posts</CardTitle>
          <CardDescription>Review, moderate, and manage user-generated social posts.</CardDescription>
        </CardHeader>
        <CardContent>
          {posts && posts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell>
                      {post.user_profiles?.first_name && post.user_profiles?.last_name 
                        ? `${post.user_profiles.first_name} ${post.user_profiles.last_name}`
                        : post.user_profiles?.username || 'Unknown User'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        post.moderation_status === 'approved' ? 'default' :
                        post.moderation_status === 'rejected' ? 'destructive' :
                        'secondary'
                      }>
                        {post.moderation_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.visibility === 'public' ? 'outline' : 'secondary'}>
                        {post.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {post.is_testimonial ? (
                        <Badge variant="outline">Testimonial</Badge>
                      ) : (
                        <span className="text-muted-foreground">Regular</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(post.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPost(post)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        {post.moderation_status === 'pending' && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled={moderatePostMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Approve Post</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to approve this post? It will become visible to all users.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleModeratePost(post.id, 'approved')}
                                  >
                                    Approve
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={moderatePostMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject Post</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to reject this post? It will not be visible to users.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleModeratePost(post.id, 'rejected')}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Reject
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletePostMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Post</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this post? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePost(post.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground">No social posts found.</p>
          )}
        </CardContent>
      </Card>

      {selectedPost && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedPost.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Author:</strong> {
                    selectedPost.user_profiles?.first_name && selectedPost.user_profiles?.last_name 
                      ? `${selectedPost.user_profiles.first_name} ${selectedPost.user_profiles.last_name}`
                      : selectedPost.user_profiles?.username || 'Unknown User'
                  }</p>
                  <p><strong>Status:</strong> {selectedPost.moderation_status}</p>
                  <p><strong>Visibility:</strong> {selectedPost.visibility}</p>
                </div>
                <div>
                  <p><strong>Type:</strong> {selectedPost.is_testimonial ? 'Testimonial' : 'Regular Post'}</p>
                  <p><strong>Created:</strong> {new Date(selectedPost.created_at).toLocaleString()}</p>
                </div>
              </div>
              {selectedPost.image_url && (
                <div>
                  <p className="font-medium mb-2">Media:</p>
                  {selectedPost.image_url.includes('.mp4') || selectedPost.image_url.includes('video') ? (
                    <video 
                      src={selectedPost.image_url} 
                      controls 
                      className="max-w-full h-auto rounded-lg"
                      style={{ maxHeight: '300px' }}
                    />
                  ) : (
                    <img 
                      src={selectedPost.image_url} 
                      alt="Post media" 
                      className="max-w-full h-auto rounded-lg"
                    />
                  )}
                </div>
              )}
              <div>
                <p className="font-medium mb-2">Content:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.content}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
