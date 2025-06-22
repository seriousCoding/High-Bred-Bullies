
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BlogPostForm, BlogPostFormValues } from '@/components/blog/BlogPostForm';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
interface BlogPost {
  id: number;
  title: string;
  content: string;
  excerpt?: string;
  slug: string;
  featuredImage?: string;
  tags?: string[];
  isPublished: boolean;
  publishedAt?: string;
  authorId: number;
  createdAt: string;
  updatedAt: string;
}

const fetchBlogPostById = async (id: string): Promise<BlogPost> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token');
  }

  const response = await fetch(`${API_BASE_URL}/api/blog-posts/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch blog post: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data) throw new Error("Blog post not found.");
  return data;
};

const EditBlogPostPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blogPost', id],
    queryFn: () => fetchBlogPostById(id!),
    enabled: !!id,
  });

  const { mutate: updatePost, isPending: isSubmitting } = useMutation({
    mutationFn: async (values: BlogPostFormValues) => {
      if (!id) throw new Error("No post ID provided");
      const { data, error: updateError } = await supabase
        .from('blog_posts')
        .update({
          title: values.title,
          content: values.content,
          excerpt: values.excerpt,
          category: values.category,
          image_url: values.image_url,
          author_name: values.author_name,
          published_at: values.is_published ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select();
      
      if (updateError) throw updateError;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Blog post updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['blogPost', id] });
      queryClient.invalidateQueries({ queryKey: ['publishedBlogPosts'] });
      navigate('/admin');
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: `Failed to update post: ${(err as Error).message}`,
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = (values: BlogPostFormValues) => {
    updatePost(values);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-12">
            <Alert variant="destructive" className="max-w-2xl mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Fetching Blog Post</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit Blog Post</h1>
        {post && (
          <BlogPostForm 
            onSubmit={handleFormSubmit} 
            defaultValues={post} 
            isSubmitting={isSubmitting} 
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default EditBlogPostPage;
