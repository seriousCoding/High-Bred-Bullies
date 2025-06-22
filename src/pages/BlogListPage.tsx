
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BlogPostItem, BlogPost } from '@/components/BlogPostItem';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

const fetchPublishedBlogPosts = async (): Promise<BlogPost[]> => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, title, excerpt, category, published_at, image_url, author_name, updated_at')
    .not('published_at', 'is', null) // Only fetch published posts
    .order('published_at', { ascending: false });

  if (error) throw error;
  return data as BlogPost[];
};

const BlogListPage = () => {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['publishedBlogPosts', 'v2'],
    queryFn: fetchPublishedBlogPosts,
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4">High Bred Bullies Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay updated with the latest news, tips, and stories for your furry friends.
          </p>
        </div>
        
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Blog Posts</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {posts && posts.length > 0 && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <BlogPostItem key={post.id} post={post} />
            ))}
          </div>
        )}

        {posts && posts.length === 0 && !isLoading && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-xl mb-4">No blog posts published yet. Check back soon!</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogListPage;
