
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';
import { SocialPost } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PostCard from '@/components/PostCard';
import HighTableInviteDialog from '@/components/HighTableInviteDialog';
import CreatePostCard from '@/components/CreatePostCard';
import MessagingInterface from '@/components/MessagingInterface';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, Heart, Plus, Loader2, Lock, Crown, Star } from 'lucide-react';

const HighTablePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { userProfile, isPetOwner, isOnboarding, isReady } = useUserOnboarding();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    console.log('Fetching posts from social_feed_posts...');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${API_BASE_URL}/api/social-posts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.statusText}`);
      }

      const postData = await response.json();
      console.log('Posts fetched:', postData);

      if (!postData || !Array.isArray(postData)) {
        throw new Error('Invalid posts data received');
      }

    const postsWithCorrectedKeys = postData.map(p => ({
      ...p,
      is_liked_by_user: p.liked_by_user,
    }));

    setPosts(postsWithCorrectedKeys as SocialPost[]);
    setLoading(false);
  } catch (error) {
    console.error('Error fetching posts:', error);
    toast({ title: 'Error', description: 'Could not fetch posts.', variant: 'destructive' });
    setLoading(false);
  }
}, [toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({ title: 'Authentication required', description: 'You must be logged in to like a post.', variant: 'destructive' });
      return;
    }

    if (!isPetOwner) {
      toast({ title: 'High Table access required', description: 'Purchase a pet to unlock community features.', variant: 'destructive' });
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.is_liked_by_user) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/social-posts/${postId}/unlike`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to unlike post');
        }
        
        setPosts(posts.map(p => p.id === postId ? { ...p, is_liked_by_user: false, likes_count: (p.likes_count || 1) - 1 } : p));
      } catch (error) {
        console.error('Error unliking post:', error);
        toast({ title: 'Error', description: 'Could not unlike post.', variant: 'destructive' });
      }
    } else {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/social-posts/${postId}/like`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to like post');
        }
        
        setPosts(posts.map(p => p.id === postId ? { ...p, is_liked_by_user: true, likes_count: (p.likes_count || 0) + 1 } : p));
      } catch (error) {
        console.error('Error liking post:', error);
        toast({ title: 'Error', description: 'Could not like post.', variant: 'destructive' });
      }
    }
  };

  const handleFollow = async (profileIdToFollow: string) => {
    if (!user || !userProfile) {
      toast({ title: 'Authentication required', description: 'You must be logged in to follow someone.', variant: 'destructive' });
      return;
    }

    if (!isPetOwner) {
      toast({ title: 'High Table access required', description: 'Purchase a pet to unlock community features.', variant: 'destructive' });
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ followingId: profileIdToFollow }),
      });

      if (!response.ok) {
        throw new Error('Failed to follow user');
      }
      
      toast({ title: 'Success!', description: 'You are now following this user.' });
    } catch (error) {
      console.error('Error following user:', error);
      toast({ title: 'Error', description: 'Could not follow user.', variant: 'destructive' });
    }
  };

  const handlePostCreated = () => {
    fetchPosts();
  };

  const handlePostDelete = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  // Scroll to create post section
  const scrollToCreatePost = () => {
    const createPostElement = document.querySelector('[data-create-post]');
    if (createPostElement) {
      createPostElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Show loading while initializing user
  if (isOnboarding) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Checking your High Table access...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  console.log('HighTablePage Debug:', {
    user: !!user,
    userProfile: !!userProfile,
    isPetOwner,
    isReady,
    userProfileId: userProfile?.id
  });

  const renderFeedContent = () => (
    <>
      {!user && (
        <Card className="mb-8 bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold">Welcome to High Table Preview!</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              You're viewing a preview of our exclusive pet owner community. Sign in and purchase a pet to unlock full access.
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/litters">Browse Available Pets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {user && !isPetOwner && (
        <Card className="mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold">High Table Access Required</h3>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Exclusive</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              High Table is our exclusive community for pet owners. Purchase a pet from our available litters to unlock full community access including posting, messaging, and connecting with other pet owners.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/litters" className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Unlock High Table Access
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/profile">View Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Create Post Section - Only for pet owners */}
      {user && userProfile && isPetOwner && isReady && (
        <div data-create-post>
          <CreatePostCard 
            userProfileId={userProfile.id} 
            onPostCreated={handlePostCreated}
          />
        </div>
      )}
      
      {loading ? (
        <div className="space-y-6">
            <Skeleton className="h-[250px] w-full rounded-xl" />
            <Skeleton className="h-[250px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No posts yet in the High Table community.</p>
                {user && userProfile && isPetOwner ? (
                  <p className="text-sm text-gray-500">Be the first to share your pet story with the community!</p>
                ) : (
                  <p className="text-sm text-gray-500">Purchase a pet to start sharing and connecting with other pet owners.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            posts.map(post => (
              <PostCard 
                key={post.id}
                post={post}
                onLike={handleLike}
                onFollow={handleFollow}
                onDelete={handlePostDelete}
                currentProfileId={userProfile?.id}
              />
            ))
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        {/* Enhanced Header - Different for pet owners vs non-owners */}
        {user && userProfile && isPetOwner && isReady ? (
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-8 w-8 text-yellow-600" />
                  <h1 className="text-3xl font-bold">High Table Community</h1>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Member</span>
                </div>
                <p className="text-muted-foreground">Exclusive community for pet owners - connect, share, and engage</p>
              </div>
              <div className="flex items-center gap-2">
                <HighTableInviteDialog currentProfileId={userProfile.id} />
              </div>
            </div>
            
            {/* Quick Actions for Members */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={scrollToCreatePost}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Plus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Share a Post</h3>
                    <p className="text-sm text-muted-foreground">Tell your pet story</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab('friends')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Find Pet Owners</h3>
                    <p className="text-sm text-muted-foreground">Connect with community</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab('messages')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Messages</h3>
                    <p className="text-sm text-muted-foreground">Chat with friends</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-yellow-600" />
              <div>
                <h1 className="text-3xl font-bold">High Table</h1>
                <p className="text-muted-foreground">Exclusive Pet Owner Community</p>
              </div>
            </div>
            {!user && (
              <Button asChild>
                <Link to="/auth" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            {/* Show tabs for all authenticated users with profiles */}
            {user && userProfile && isReady ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="feed" className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Feed
                  </TabsTrigger>
                  <TabsTrigger value="friends" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Friends
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="feed" className="space-y-6">
                  {renderFeedContent()}
                </TabsContent>
                <TabsContent value="friends">
                  <MessagingInterface />
                </TabsContent>
                <TabsContent value="messages">
                  <MessagingInterface />
                </TabsContent>
              </Tabs>
            ) : (
              renderFeedContent()
            )}
          </div>
          
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {user && userProfile && isPetOwner ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-yellow-600" />
                      Member Benefits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                      <Plus className="h-4 w-4 text-blue-600" />
                      <span>Create posts & stories</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                      <Users className="h-4 w-4 text-green-600" />
                      <span>Send friend requests</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                      <MessageSquare className="h-4 w-4 text-purple-600" />
                      <span>Direct messaging</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                      <Heart className="h-4 w-4 text-orange-600" />
                      <span>Like & comment on posts</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-yellow-200 bg-gradient-to-b from-yellow-50 to-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-yellow-600" />
                      Unlock High Table
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <p className="text-muted-foreground mb-3">
                      Purchase a pet to join our exclusive community of pet owners.
                    </p>
                    <div className="space-y-2 opacity-60">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <span>Share pet stories</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <span>Connect with other owners</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <span>Exclusive messaging</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-400" />
                        <span>Community events</span>
                      </div>
                    </div>
                    <div className="pt-3">
                      <Button asChild className="w-full mb-2">
                        <Link to="/litters" className="flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          Browse Available Pets
                        </Link>
                      </Button>
                      {!user && (
                        <Button asChild variant="outline" className="w-full">
                          <Link to="/auth">Sign In</Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle>Community Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li>• High Table is exclusive to verified pet owners</li>
                    <li>• Share relevant pet-related content</li>
                    <li>• Be respectful to other members</li>
                    <li>• Posts are auto-approved for members</li>
                    <li>• Private posts are visible only to you</li>
                    <li>• Public posts are visible to all members</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HighTablePage;
