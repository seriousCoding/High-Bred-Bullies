
import React from 'react';
import { formatDistanceToNow } from 'date-fns';

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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isOwn
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <p className="text-sm break-words">{message.content}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs ${
            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
          {isOwn && (
            <span className={`text-xs ml-2 ${
              message.is_read ? 'text-primary-foreground/70' : 'text-primary-foreground'
            }`}>
              {message.is_read ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
