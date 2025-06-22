import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
    
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        user1:user_profiles!friendships_user1_id_fkey(*),
        user2:user_profiles!friendships_user2_id_fkey(*)
      `)
      .or(`user1_id.eq.${userProfile.id},user2_id.eq.${userProfile.id}`);
    
    if (data && !error) {
      const friendsData = data.map(friendship => {
        return friendship.user1_id === userProfile.id 
          ? friendship.user2 
          : friendship.user1;
      });
      setFriends(friendsData);
    }
  };

  // Fetch friend requests
  const fetchFriendRequests = async () => {
    if (!userProfile) return;
    
    const { data: received, error: receivedError } = await supabase
      .from('friend_requests')
      .select(`
        *,
        sender:user_profiles!friend_requests_sender_id_fkey(*)
      `)
      .eq('receiver_id', userProfile.id)
      .eq('status', 'pending');

    const { data: sent, error: sentError } = await supabase
      .from('friend_requests')
      .select(`
        *,
        receiver:user_profiles!friend_requests_receiver_id_fkey(*)
      `)
      .eq('sender_id', userProfile.id)
      .eq('status', 'pending');
    
    if (received && !receivedError) {
      setFriendRequests(received);
    }
    
    if (sent && !sentError) {
      setSentRequests(sent);
    }
  };

  // Search users
  const searchUsers = async () => {
    if (!searchQuery.trim() || !userProfile) return;
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .or(`username.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
      .neq('id', userProfile.id)
      .limit(10);
    
    if (data && !error) {
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
  };

  // Send friend request
  const sendFriendRequest = async (receiverId: string) => {
    if (!userProfile || !isPetOwner) {
      toast.error('High Table access required to send friend requests');
      return;
    }

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: userProfile.id,
          receiver_id: receiverId
        });

      if (error) throw error;
      
      toast.success('Friend request sent!');
      setSearchResults([]);
      setSearchQuery('');
      fetchFriendRequests();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Friend request already sent');
      } else {
        toast.error('Failed to send friend request');
      }
    }
  };

  // Handle friend request
  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      
      if (error) throw error;
      
      toast.success('Friend request accepted!');
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      toast.error('Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
      
      if (error) throw error;
      
      toast.success('Friend request declined!');
      fetchFriendRequests();
    } catch (error) {
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
    if (searchQuery.length > 2) {
      const debounce = setTimeout(() => {
        searchUsers();
      }, 300);
      return () => clearTimeout(debounce);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  if (!isPetOwner) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">High Table access required for friends functionality.</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="friends" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="friends">
          <Users className="h-4 w-4 mr-2" />
          Friends ({friends.length})
        </TabsTrigger>
        <TabsTrigger value="search">
          <Search className="h-4 w-4 mr-2" />
          Search
        </TabsTrigger>
        <TabsTrigger value="requests">
          <UserPlus className="h-4 w-4 mr-2" />
          Requests ({friendRequests.length + sentRequests.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="friends" className="mt-4">
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {friends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                type="friend"
                onMessage={onStartConversation}
              />
            ))}
            {friends.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No friends yet. Search for users to add as friends!
              </p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="search" className="mt-4">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {searchResults.map((user) => (
                <FriendCard
                  key={user.id}
                  friend={user}
                  type="search"
                  onAddFriend={sendFriendRequest}
                />
              ))}
              {searchQuery.length > 2 && searchResults.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No users found matching "{searchQuery}"
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </TabsContent>

      <TabsContent value="requests" className="mt-4">
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {friendRequests.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Received Requests</h3>
                <div className="space-y-2">
                  {friendRequests.map((request) => (
                    <FriendCard
                      key={request.id}
                      friend={request.sender!}
                      type="request-received"
                      requestId={request.id}
                      onAcceptRequest={handleAcceptRequest}
                      onDeclineRequest={handleDeclineRequest}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {sentRequests.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Sent Requests</h3>
                <div className="space-y-2">
                  {sentRequests.map((request) => (
                    <FriendCard
                      key={request.id}
                      friend={request.receiver!}
                      type="request-sent"
                    />
                  ))}
                </div>
              </div>
            )}
            
            {friendRequests.length === 0 && sentRequests.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No pending friend requests
              </p>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

export default FriendsManager;
