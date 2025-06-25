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
      const token = localStorage.getItem('auth_token');
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
      const friendsData = data.friends || [];
      setFriends(friendsData.map(f => ({
        id: f.friend_id,
        username: f.friend_username,
        first_name: f.friend_first_name,
        last_name: f.friend_last_name,
        avatar_url: null
      })));
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Fetch friend requests
  const fetchFriendRequests = async () => {
    if (!userProfile) return;
    
    try {
      const token = localStorage.getItem('auth_token');
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
      const requestsData = data.requests || [];
      setFriendRequests(requestsData.map((req: any) => ({
        id: req.id,
        sender_id: req.sender_id,
        receiver_id: userProfile.id,
        status: req.status,
        created_at: req.created_at,
        sender: {
          username: req.sender_username,
          first_name: req.sender_first_name,
          last_name: req.sender_last_name
        }
      })));
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
      fetchFriendRequests();
      
      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.id !== receiverId));
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
    }
  };

  // Handle friend request
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

  // Effects
  useEffect(() => {
    if (userProfile && isPetOwner) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [userProfile, isPetOwner]);

  useEffect(() => {
    if (userProfile && isPetOwner) {
      const debounceTimer = setTimeout(() => {
        if (searchQuery) {
          searchUsers();
        } else {
          setSearchResults([]);
        }
      }, 300);

      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, userProfile, isPetOwner]);

  if (!userProfile || !isPetOwner) {
    return (
      <div className="text-center p-6">
        <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">High Table Required</h3>
        <p className="text-muted-foreground">
          Upgrade to High Table to access the friends system
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests ({friendRequests.length})
          </TabsTrigger>
          <TabsTrigger value="search">
            Find Friends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          <ScrollArea className="h-[400px]">
            {friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    onStartConversation={onStartConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center p-6">
                <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No friends yet</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <ScrollArea className="h-[400px]">
            {friendRequests.length > 0 ? (
              <div className="space-y-2">
                {friendRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        {request.sender?.first_name?.[0] || 'U'}
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
                        className="px-3 py-1 bg-muted text-muted-foreground rounded text-sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6">
                <UserPlus className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No pending requests</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <ScrollArea className="h-[350px]">
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        {user.first_name?.[0] || 'U'}
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
            ) : searchQuery ? (
              <div className="text-center p-6">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">No users found</p>
              </div>
            ) : (
              <div className="text-center p-6">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Start typing to search for friends</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FriendsManager;