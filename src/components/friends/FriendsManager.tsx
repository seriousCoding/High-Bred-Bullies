import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';
import { toast } from 'sonner';
import FriendCard from './FriendCard';

interface Friend {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: Friend;
  receiver?: Friend;
}

interface FriendsManagerProps {
  onStartConversation: (friendId: string) => void;
}

const FriendsManager: React.FC<FriendsManagerProps> = ({ onStartConversation }) => {
  const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
  const { user } = useAuth();
  const { userProfile, isPetOwner } = useUserOnboarding();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch friends
  const fetchFriends = async () => {
    if (!userProfile) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friends`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch friends: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.length > 0) {
        setFriends(data);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Fetch friend requests
  const fetchFriendRequests = async () => {
    if (!userProfile) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch friend requests: ${response.statusText}`);
      }

      const data = await response.json();
      const received = data.filter((req: any) => req.receiver_id === userProfile.id && req.status === 'pending');
      const sent = data.filter((req: any) => req.sender_id === userProfile.id && req.status === 'pending');
      
      setFriendRequests(received);
      setSentRequests(sent);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  // Search users
  const searchUsers = async () => {
    if (!searchQuery.trim() || !userProfile) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to search users: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data) {
        // Filter out existing friends and pending requests
        const friendIds = new Set(friends.map(f => f.id));
        const requestIds = new Set([
          ...friendRequests.map(r => r.sender?.id),
          ...sentRequests.map(r => r.receiver?.id)
        ].filter(Boolean));
        
        const filteredResults = data.filter(user => 
          !friendIds.has(user.id) && !requestIds.has(user.id)
        );
        
        setSearchResults(filteredResults);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Send friend request
  const sendFriendRequest = async (receiverId: string) => {
    if (!userProfile || !isPetOwner) {
      toast.error('High Table access required to send friend requests');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver_id: receiverId,
          status: 'pending'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send friend request: ${response.statusText}`);
      }
      
      toast.success('Friend request sent!');
      
      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.id !== receiverId));
      
      // Refresh friend requests
      fetchFriendRequests();
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
    }
  };

  // Handle friend request acceptance
  const handleAcceptRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'accepted' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to accept friend request: ${response.statusText}`);
      }
      
      toast.success('Friend request accepted!');
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'declined' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to decline friend request: ${response.statusText}`);
      }
      
      toast.success('Friend request declined!');
      fetchFriendRequests();
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast.error('Failed to decline friend request');
    }
  };

  useEffect(() => {
    if (userProfile && isPetOwner) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [userProfile, isPetOwner]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const debounceTimeout = setTimeout(searchUsers, 300);
      return () => clearTimeout(debounceTimeout);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  if (!isPetOwner) {
    return (
      <div className="p-6 text-center">
        <div className="mb-4">
          <Users className="h-16 w-16 mx-auto text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">High Table Access Required</h3>
        <p className="text-muted-foreground">
          Friends feature is available for High Table members only.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Friends</h2>
        <p className="text-muted-foreground">
          Connect with other High Table members and start conversations.
        </p>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests ({friendRequests.length})
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-6">
          <ScrollArea className="h-[400px]">
            {friends.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No friends yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Search for other members to connect with
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    onStartConversation={onStartConversation}
                    showMessageButton={true}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <ScrollArea className="h-[400px]">
            {friendRequests.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {friendRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        {request.sender?.first_name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-medium">
                          {request.sender?.first_name} {request.sender?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{request.sender?.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for friends by name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <ScrollArea className="h-[350px]">
              {searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No users found' : 'Search for other members'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                          {user.first_name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => sendFriendRequest(user.id)}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
                      >
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FriendsManager;