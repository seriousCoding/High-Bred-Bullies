import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
const API_BASE_URL = window.location.origin;
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, PlusCircle, Send, Pencil, Trash2, Bot } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BlogPost {
  id: string;
  title: string;
  category: string;
  published_at: string | null;
  created_at: string;
  content?: string;
  excerpt?: string;
  image_url?: string;
  author_name?: string;
}

const fetchBlogPosts = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/blog/posts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch blog posts');
  return await response.json();
};

const addBlogPost = async (newPost: Omit<BlogPost, 'id' | 'created_at' | 'published_at' | 'content' | 'excerpt'> & { content: string, excerpt?: string, image_url?: string, author_name?: string }) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/blog/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(newPost),
  });
  if (!response.ok) throw new Error('Failed to add blog post');
  return await response.json();
};

const publishBlogPost = async (postId: string) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/blog/posts/${postId}/publish`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to publish blog post');
  return await response.json();
};

const deleteBlogPost = async (postId: string) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/blog/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to delete blog post');
  return await response.json();
};

const generateBlogPost = async () => {
  const response = await fetch(`${API_BASE_URL}/api/ai/generate-blog-post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }
  
  return await response.json();
};

const generateSocialPosts = async () => {
  const response = await fetch(`${API_BASE_URL}/api/ai/generate-social-posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }
  
  return await response.json();
};

export const AdminBlogManager = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', excerpt: '', category: 'general', image_url: '', author_name: '' });
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['adminBlogPosts'],
    queryFn: fetchBlogPosts,
  });

  const addMutation = useMutation({
    mutationFn: addBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
      toast({ title: 'Success', description: 'Blog post added.' });
      setShowForm(false);
      setNewPost({ title: '', content: '', excerpt: '', category: 'general', image_url: '', author_name: '' });
    },
    onError: (err: any) => {
      toast({
        title: 'Error adding post',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
      queryClient.invalidateQueries({ queryKey: ['publishedBlogPosts'] });
      toast({ title: 'Success', description: 'Blog post has been published.' });
    },
    onError: (err: any) => {
      toast({
        title: 'Error publishing post',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
      toast({ title: "Success", description: "Blog post deleted." });
      setPostToDelete(null);
    },
    onError: (err: any) => {
      toast({
        title: "Error deleting post",
        description: err.message,
        variant: "destructive",
      });
      setPostToDelete(null);
    },
  });

  const generateMutation = useMutation({
    mutationFn: generateBlogPost,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
      const title = data?.title || data?.post?.title || 'AI Blog Post';
      toast({ 
        title: 'Success', 
        description: `New blog post "${title}" has been generated.` 
      });
    },
    onError: (err: any) => {
      console.error('Blog generation error:', err);
      toast({
        title: 'Error generating blog post',
        description: err?.message || 'Failed to generate blog post. Please check console for details.',
        variant: 'destructive',
      });
    },
  });

  const generateSocialMutation = useMutation({
    mutationFn: generateSocialPosts,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['socialPosts'] });
      queryClient.invalidateQueries({ queryKey: ['social_feed_posts'] });
      const count = data?.count || 'several';
      toast({ 
        title: 'Success', 
        description: `Generated ${count} AI social posts for High Table.` 
      });
    },
    onError: (err: any) => {
      console.error('Social posts generation error:', err);
      toast({
        title: 'Error generating social posts',
        description: err?.message || 'Failed to generate social posts. Please check console for details.',
        variant: 'destructive',
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setNewPost(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(newPost);
  };

  const handleToggleForm = () => {
    setShowForm(!showForm);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Blog Post Management</h2>
            <p className="text-sm text-gray-600 mt-1">Create, edit, and manage blog posts.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={() => generateMutation.mutate()} variant="outline" size="sm" disabled={generateMutation.isPending} className="text-xs">
                {generateMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PlusCircle className="mr-1 h-3 w-3" />}
                Generate New AI Blog Post
            </Button>
            <Button onClick={() => generateSocialMutation.mutate()} variant="outline" size="sm" disabled={generateSocialMutation.isPending} className="text-xs">
                {generateSocialMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bot className="mr-1 h-3 w-3" />}
                Generate AI Social Posts
            </Button>
            <Button onClick={handleToggleForm} variant="outline" size="sm" className="text-xs">
              <PlusCircle className="mr-1 h-3 w-3" />
              {showForm ? 'Cancel' : 'Add New Post'}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {posts && posts.length > 0 ? (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-0 text-sm font-medium text-gray-500">Title</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                  <th className="text-right py-3 px-0 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-0 text-sm font-medium text-gray-900">{post.title}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{post.category}</td>
                    <td className="py-4 px-4 text-sm">
                      {post.published_at ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{new Date(post.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</td>
                    <td className="py-4 px-0 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="outline" size="sm" asChild className="text-xs">
                          <Link to={`/admin/blog/edit/${post.id}`}>
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Link>
                        </Button>
                        {!post.published_at && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => publishMutation.mutate(post.id)}
                            disabled={publishMutation.isPending && publishMutation.variables === post.id}
                            className="text-xs"
                          >
                             {publishMutation.isPending && publishMutation.variables === post.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="mr-1 h-3 w-3" />
                            )}
                            Publish
                          </Button>
                        )}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setPostToDelete(post)}
                            disabled={deleteMutation.isPending && deleteMutation.variables === post.id}
                            className="text-xs"
                        >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No blog posts found.</p>
          </div>
        )}
      </div>
      
      {postToDelete && (
        <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the blog post "{postToDelete.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(postToDelete.id)}
                className={cn(buttonVariants({ variant: "destructive" }))}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && deleteMutation.variables === postToDelete.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                ) : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Blog Post</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={newPost.title} onChange={(e) => handleInputChange('title', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <select id="category" value={newPost.category} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full p-2 border rounded-md">
                  <option value="general">General</option>
                  <option value="nutrition">Nutrition</option>
                  <option value="health">Health</option>
                  <option value="training">Training</option>
                  <option value="treats">Treats</option>
                  <option value="lifestyle">Lifestyle</option>
                </select>
              </div>
              <div>
                <Label htmlFor="author_name">Author Name (optional)</Label>
                <Input id="author_name" value={newPost.author_name} onChange={(e) => handleInputChange('author_name', e.target.value)} placeholder="e.g. Dr. Paws" />
              </div>
              <div>
                <Label htmlFor="image_url">Image URL (optional)</Label>
                <Input id="image_url" value={newPost.image_url} onChange={(e) => handleInputChange('image_url', e.target.value)} placeholder="https://images.unsplash.com/..." />
              </div>
              <div>
                <Label htmlFor="content">Content (Markdown supported)</Label>
                <Textarea id="content" value={newPost.content} onChange={(e) => handleInputChange('content', e.target.value)} rows={10} required />
              </div>
              <div>
                <Label htmlFor="excerpt">Excerpt (optional)</Label>
                <Textarea id="excerpt" value={newPost.excerpt} onChange={(e) => handleInputChange('excerpt', e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Post'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};