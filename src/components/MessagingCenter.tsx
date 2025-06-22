
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserOnboarding } from '@/hooks/useUserOnboarding';
import { toast } from 'sonner';
import ConversationList from './messaging/ConversationList';
import MessageBubble from './messaging/MessageBubble';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

interface Friend {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
  };
}

interface Conversation {
  friend: Friend;
  lastMessage?: Message;
  unreadCount: number;
}

interface MessagingCenterProps {
  preSelectedConversation?: string | null;
}

const MessagingCenter: React.FC<MessagingCenterProps> = ({ preSelectedConversation }) => {
  const { user } = useAuth();
  const { userProfile, isPetOwner } = useUserOnboarding();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(preSelectedConversation || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (preSelectedConversation) {
      setSelectedConversation(preSelectedConversation);
      fetchMessages(preSelectedConversation);
    }
  }, [preSelectedConversation]);

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
            friend: conversationPartner,
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

  const fetchMessages = async (friendId: string) => {
    if (!userProfile) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/messages/${friendId}`, {
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
        body: JSON.stringify({ sender_id: friendId }),
      });

    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !userProfile) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver_id: selectedConversation,
          content: newMessage.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      setNewMessage('');
      fetchMessages(selectedConversation);
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Set up real-time updates with polling (replaces Supabase subscriptions)
  useEffect(() => {
    if (!userProfile) return;

    const pollInterval = setInterval(() => {
      if (selectedConversation) {
        fetchMessages(selectedConversation);
      }
      fetchConversations();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [userProfile, selectedConversation]);

  useEffect(() => {
    if (userProfile && isPetOwner) {
      fetchConversations();
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationList
              conversations={conversations}
              selectedConversationId={selectedConversation}
              onSelectConversation={(friendId) => {
                setSelectedConversation(friendId);
                fetchMessages(friendId);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {selectedConversation ? (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>
                {(() => {
                  const conversation = conversations.find(c => c.friend.id === selectedConversation);
                  return conversation ? `${conversation.friend.first_name} ${conversation.friend.last_name}` : 'Conversation';
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 mb-4 max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.sender_id === userProfile?.id}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
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
                  className="min-h-[60px] resize-none"
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
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start messaging</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MessagingCenter;
