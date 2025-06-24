
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
const API_BASE_URL = window.location.origin;
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Loader2, AlertTriangle, User, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const fetchBlogPostById = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/posts/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch blog post');
  }
  
  return await response.json();
};

const BlogPostPage = () => {
  const { id } = useParams<{ id:string }>();
  const isMobile = useIsMobile();

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blogPost', id, 'v2'],
    queryFn: () => fetchBlogPostById(id!),
    enabled: !!id,
  });
  
  const placeholderImage = 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=1000';

  const getCacheBustedUrl = (url: string | null | undefined, updated_at: string | undefined) => {
    if (!url || !updated_at) return url || placeholderImage;
    
    // Check if it's an expired DALL-E URL (contains st= and se= parameters)
    if (url.includes('oaidalleapiprodscus.blob.core.windows.net') && url.includes('se=')) {
      // Extract expiration time
      const seMatch = url.match(/se=([^&]+)/);
      if (seMatch) {
        const expirationTime = new Date(decodeURIComponent(seMatch[1]));
        const now = new Date();
        if (now > expirationTime) {
          // URL has expired, use placeholder
          return placeholderImage;
        }
      }
    }
    
    const date = new Date(updated_at).getTime();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${date}`;
  };

  const markdownComponents = {
      h2: ({node, ...props}: any) => <h2 className="text-3xl font-bold mt-10 mb-5" {...props} />,
      h3: ({node, ...props}: any) => <h3 className="text-2xl font-bold mt-8 mb-4" {...props} />,
      p: ({node, ...props}: any) => <p className="mb-6 leading-relaxed" {...props} />,
      a: ({node, ...props}: any) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
      ul: ({node, ...props}: any) => <ul className="list-disc list-inside mb-6 pl-4 space-y-2" {...props} />,
      ol: ({node, ...props}: any) => <ol className="list-decimal list-inside mb-6 pl-4 space-y-2" {...props} />,
      blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-primary/50 pl-6 italic my-8 text-gray-600 dark:text-gray-400" {...props} />,
      code: ({node, inline, className, children, ...props}: {node?: any, inline?: boolean, className?: string, children?: React.ReactNode}) => {
        const match = /language-(\w+)/.exec(className || '')
        return !inline ? (
          <pre className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-md overflow-x-auto my-6">
            <code className={cn("font-mono", match && `language-${match[1]}`)} {...props}>
              {String(children).replace(/\n$/, '')}
            </code>
          </pre>
        ) : (
          <code className="bg-gray-100 dark:bg-gray-800/50 px-1.5 py-1 rounded font-mono" {...props}>
            {children}
          </code>
        )
      },
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black">
      <Navbar />
      <main className="flex-grow">
        {isLoading && (
          <div className="flex justify-center items-center h-[60vh]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}

        {error && (
            <div className="container mx-auto px-4 py-12">
                <Alert variant="destructive" className="max-w-2xl mx-auto">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Fetching Blog Post</AlertTitle>
                    <AlertDescription>{(error as Error).message}. This post may not be published yet or does not exist.</AlertDescription>
                </Alert>
            </div>
        )}

        {post && (
          isMobile ? (
            // Mobile Layout
            <div>
              <div className="relative h-[70vh]">
                <img
                  src={getCacheBustedUrl(post.image_url, post.updated_at)}
                  alt={post.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 container mx-auto px-4 sm:px-6 flex flex-col justify-end pb-12">
                  <header>
                    {post.category && (
                        <p className="text-sm font-bold text-primary uppercase tracking-widest">
                            {post.category}
                        </p>
                    )}
                    <h1 className="text-4xl md:text-5xl font-serif font-medium text-white leading-tight mt-4">
                      “{post.title}”
                    </h1>
                    <div className="mt-6 border-t border-gray-200/30 py-4 flex justify-between items-center text-sm text-gray-300">
                      <div className="flex items-center space-x-2">
                        {post.author_name && (
                          <>
                            <User className="h-5 w-5" />
                            <span>By {post.author_name}</span>
                          </>
                        )}
                        {post.published_at && (
                          <>
                            <span className="hidden sm:inline px-2">|</span>
                            <time dateTime={post.published_at}>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-5 w-5" />
                        <span>4 Comments</span>
                      </div>
                    </div>
                  </header>
                </div>
              </div>
              <article className="container mx-auto px-4 sm:px-6 py-12">
                <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {post.content || ''}
                  </ReactMarkdown>
                </div>
              </article>
            </div>
          ) : (
            // Desktop Layout
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-row">
                <div className="w-1/2 h-screen sticky top-0 py-16 pr-8">
                  {post.image_url && (
                    <img
                      src={getCacheBustedUrl(post.image_url, post.updated_at)}
                      alt={post.title}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  )}
                </div>

                <div className="w-1/2 py-8 lg:py-16 pl-8">
                  <article>
                    <header className="mb-8">
                      {post.category && (
                          <p className="text-sm font-bold text-primary uppercase tracking-widest">
                              {post.category}
                          </p>
                      )}
                      <h1 className="text-4xl md:text-5xl font-serif font-medium text-gray-900 dark:text-white leading-tight mt-4">
                        “{post.title}”
                      </h1>
                      <div className="mt-6 border-t border-b border-gray-200 dark:border-gray-700 py-4 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          {post.author_name && (
                            <>
                              <User className="h-5 w-5" />
                              <span>By {post.author_name}</span>
                            </>
                          )}
                          {post.published_at && (
                            <>
                              <span className="hidden sm:inline px-2">|</span>
                              <time dateTime={post.published_at}>{new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                            </>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-5 w-5" />
                          <span>4 Comments</span>
                        </div>
                      </div>
                    </header>
                    <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {post.content || ''}
                      </ReactMarkdown>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogPostPage;
