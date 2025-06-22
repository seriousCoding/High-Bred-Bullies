
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

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
}

interface Conversation {
  friend: Friend;
  lastMessage?: Message;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (friendId: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation
}) => {
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2">
        {conversations.map((conversation) => (
          <div
            key={conversation.friend.id}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
              selectedConversationId === conversation.friend.id ? 'bg-muted' : ''
            }`}
            onClick={() => onSelectConversation(conversation.friend.id)}
          >
            <Avatar>
              <AvatarImage src={conversation.friend.avatar_url} />
              <AvatarFallback>
                {conversation.friend.first_name?.charAt(0)}{conversation.friend.last_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="font-medium truncate">
                  {conversation.friend.first_name} {conversation.friend.last_name}
                </p>
                {conversation.lastMessage && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conversation.lastMessage.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              {conversation.lastMessage && (
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.lastMessage.content}
                </p>
              )}
              {!conversation.lastMessage && (
                <p className="text-sm text-muted-foreground">Start a conversation</p>
              )}
            </div>
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No conversations yet. Add friends to start messaging!
          </p>
        )}
      </div>
    </ScrollArea>
  );
};

export default ConversationList;
