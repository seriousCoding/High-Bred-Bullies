
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Calendar, UserCircle } from 'lucide-react';

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string | null;
  category: string;
  published_at: string | null;
  image_url: string | null;
  author_name: string | null;
  updated_at: string;
}

interface BlogPostItemProps {
  post: BlogPost;
}

export const BlogPostItem: React.FC<BlogPostItemProps> = ({ post }) => {
  const placeholderImage = 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=500';

  const getCacheBustedUrl = (url: string | null | undefined, updated_at: string) => {
    if (!url) return placeholderImage;
    const date = new Date(updated_at).getTime();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${date}`;
  };

  return (
    <Card className="flex flex-col overflow-hidden h-full group">
      <Link to={`/blog/${post.id}`} className="block overflow-hidden">
        <img
          src={getCacheBustedUrl(post.image_url, post.updated_at)}
          alt={post.title}
          className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== placeholderImage) {
              target.src = placeholderImage;
            }
          }}
        />
      </Link>
      <CardHeader>
        <p className="text-sm font-medium text-primary uppercase tracking-wider">{post.category}</p>
        <CardTitle className="mt-2 text-xl">
          <Link to={`/blog/${post.id}`} className="hover:text-primary transition-colors">{post.title}</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground line-clamp-3">{post.excerpt || 'No excerpt available.'}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center text-sm text-muted-foreground border-t pt-4 mt-auto">
        <div className="flex items-center space-x-2">
          <UserCircle className="h-4 w-4" />
          <span>{post.author_name || 'Pawsitive Team'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4" />
          <span>{post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Draft'}</span>
        </div>
      </CardFooter>
    </Card>
  );
};
