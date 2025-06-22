import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { MessageSquare, Users, UserPlus, Send, Search, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  sender: UserProfile;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender: UserProfile;
  receiver: UserProfile;
}

interface Conversation {
  user: UserProfile;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

const MessagingInterface = () => {
  const { user } = useAuth();
  const { userProfile, isPetOwner } = useUserOnboarding();
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch conversations
  const fetchConversations = async () => {
    if (!userProfile) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.statusText}`);
      }

      const data = await response.json();

      // Group messages by conversation partner
      const conversationMap = new Map<string, Conversation>();
      
      data?.forEach((msg: any) => {
        const isFromCurrentUser = msg.sender_id === userProfile.id;
        const conversationPartner = isFromCurrentUser ? msg.receiver : msg.sender;
        const partnerId = conversationPartner.id;

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            user: conversationPartner,
            lastMessage: msg,
            unreadCount: 0
          });
        }

        // Count unread messages from this partner
        if (!isFromCurrentUser && !msg.is_read) {
          const conv = conversationMap.get(partnerId)!;
          conv.unreadCount++;
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch messages for selected conversation
  const fetchMessages = async (partnerId: string) => {
    if (!userProfile) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/messages/${partnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages(data || []);

      // Mark messages as read
      await fetch(`${API_BASE_URL}/api/messages/mark-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sender_id: partnerId }),
      });

    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

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

      const friendsList = await response.json();
      setFriends(friendsList || []);
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
      setFriendRequests(data || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  // Fetch all users
  const fetchAllUsers = async () => {
    if (!userProfile) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
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
          receiver_id: receiverId,
          status: 'pending'
        });

      if (error) throw error;
      
      toast.success('Friend request sent!');
      fetchAllUsers(); // Refresh to update button states
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
    }
  };

  // Handle friend request
  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      
      toast.success(`Friend request ${action}ed`);
      fetchFriendRequests();
      if (action === 'accept') {
        fetchFriends();
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
      toast.error(`Failed to ${action} friend request`);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !userProfile) return;

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: userProfile.id,
          receiver_id: selectedConversation,
          content: newMessage.trim()
        });

      if (error) throw error;
      
      setNewMessage('');
      fetchMessages(selectedConversation);
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  useEffect(() => {
    if (userProfile && isPetOwner) {
      fetchConversations();
      fetchFriends();
      fetchFriendRequests();
      fetchAllUsers();
      setLoading(false);
    }
  }, [userProfile, isPetOwner]);

  if (!user || !userProfile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Please sign in to access messaging.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isPetOwner) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground mb-4">High Table access required for messaging features.</p>
          <p className="text-sm text-gray-500">Purchase a pet to unlock community messaging.</p>
        </CardContent>
      </Card>
    );
  }

  const filteredUsers = allUsers.filter(user =>
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      <div className="lg:col-span-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2 relative">
              <UserPlus className="h-4 w-4" />
              Requests
              {friendRequests.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {friendRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {conversations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No conversations yet</p>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.user.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 ${
                          selectedConversation === conv.user.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => {
                          setSelectedConversation(conv.user.id);
                          fetchMessages(conv.user.id);
                        }}
                      >
                        <Avatar>
                          <AvatarImage src={conv.user.avatar_url} />
                          <AvatarFallback>
                            {conv.user.first_name?.[0]}{conv.user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {conv.user.first_name} {conv.user.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage?.content}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Find Friends</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {filteredUsers.map((user) => {
                    const isFriend = friends.some(friend => friend.id === user.id);
                    const hasPendingRequest = friendRequests.some(req => 
                      req.sender_id === userProfile.id && req.receiver_id === user.id
                    );
                    
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                        {isFriend ? (
                          <Badge variant="secondary">Friends</Badge>
                        ) : hasPendingRequest ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => sendFriendRequest(user.id)}
                            className="flex items-center gap-2"
                          >
                            <UserPlus className="h-4 w-4" />
                            Add Friend
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Friend Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {friendRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No pending requests</p>
                  ) : (
                    friendRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={request.sender.avatar_url} />
                            <AvatarFallback>
                              {request.sender.first_name?.[0]}{request.sender.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{request.sender.first_name} {request.sender.last_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleFriendRequest(request.id, 'accept')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFriendRequest(request.id, 'reject')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="lg:col-span-2">
        {selectedConversation ? (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>
                {(() => {
                  const conversation = conversations.find(c => c.user.id === selectedConversation);
                  return conversation ? `${conversation.user.first_name} ${conversation.user.last_name}` : 'Conversation';
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === userProfile?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_id === userProfile?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p>{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender_id === userProfile?.id 
                            ? 'text-primary-foreground/70' 
                            : 'text-muted-foreground'
                        }`}>
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="min-h-[60px]"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <CardContent>
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MessagingInterface;
