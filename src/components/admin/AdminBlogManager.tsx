import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
const API_BASE_URL = window.location.origin;
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPost),
  });
  if (!response.ok) throw new Error('Failed to create blog post');
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
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/ai/generate-blog-post`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }
  
  return await response.json();
};;

const generateSocialPosts = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/ai/generate-social-posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
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
    if (!newPost.title || !newPost.content || !newPost.category) {
      toast({ title: 'Error', description: 'Title, content, and category are required.', variant: 'destructive' });
      return;
    }
    addMutation.mutate(newPost);
  };

  const handleToggleForm = () => {
    if (showForm) { // If form is open, we are cancelling
        setNewPost({ title: '', content: '', excerpt: '', category: 'general', image_url: '', author_name: '' });
    }
    setShowForm(!showForm);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Blog Post Management</CardTitle>
            <CardDescription>Create, edit, and manage blog posts.</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={() => generateMutation.mutate()} variant="outline" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Generate New AI Blog Post
            </Button>
            <Button onClick={() => generateSocialMutation.mutate()} variant="outline" disabled={generateSocialMutation.isPending}>
                {generateSocialMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                Generate AI Social Posts
            </Button>
            <Button onClick={handleToggleForm} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add New Post'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 border rounded-md">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={newPost.title} onChange={e => handleInputChange('title', e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select id="category" value={newPost.category} onChange={e => handleInputChange('category', e.target.value)} className="w-full p-2 border rounded-md">
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
              <Input id="author_name" value={newPost.author_name} onChange={e => handleInputChange('author_name', e.target.value)} placeholder="e.g. Dr. Paws" />
            </div>
            <div>
              <Label htmlFor="image_url">Image URL (optional)</Label>
              <Input id="image_url" value={newPost.image_url} onChange={e => handleInputChange('image_url', e.target.value)} placeholder="https://images.unsplash.com/..." />
                <p className="text-sm text-muted-foreground mt-1">
                  You can use placeholder images from <a href="https://unsplash.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Unsplash</a>.
                </p>
            </div>
            <div>
              <Label htmlFor="content">Content (Markdown supported)</Label>
              <Textarea id="content" value={newPost.content} onChange={e => handleInputChange('content', e.target.value)} rows={10} required />
            </div>
            <div>
              <Label htmlFor="excerpt">Excerpt (optional)</Label>
              <Textarea id="excerpt" value={newPost.excerpt} onChange={e => handleInputChange('excerpt', e.target.value)} rows={3} />
            </div>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Post'}
            </Button>
          </form>
        )}

        {posts && posts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>{post.category}</TableCell>
                  <TableCell>{post.published_at ? <span className="text-green-600 font-semibold">Published</span> : 'Draft'}</TableCell>
                  <TableCell>{new Date(post.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={(publishMutation.isPending && publishMutation.variables === post.id)}
                    >
                      <Link to={`/admin/blog/edit/${post.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    {!post.published_at && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => publishMutation.mutate(post.id)}
                        disabled={publishMutation.isPending && publishMutation.variables === post.id}
                      >
                         {publishMutation.isPending && publishMutation.variables === post.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Publish
                      </Button>
                    )}
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPostToDelete(post)}
                        disabled={deleteMutation.isPending && deleteMutation.variables === post.id}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground">No blog posts found.</p>
        )}
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
        <p className="mt-4 text-sm text-muted-foreground">
          Note: A new blog post will be generated by AI as a draft once a day. You can edit and publish it from here.
        </p>
      </CardContent>
    </Card>
  );
};
