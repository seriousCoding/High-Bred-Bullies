
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, MessageCircle, Check, X, Clock } from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface FriendCardProps {
  friend: Friend;
  type: 'friend' | 'search' | 'request-sent' | 'request-received';
  onAddFriend?: (id: string) => void;
  onMessage?: (id: string) => void;
  onAcceptRequest?: (id: string) => void;
  onDeclineRequest?: (id: string) => void;
  requestId?: string;
}

const FriendCard: React.FC<FriendCardProps> = ({
  friend,
  type,
  onAddFriend,
  onMessage,
  onAcceptRequest,
  onDeclineRequest,
  requestId
}) => {
  return (
    <Card className="p-3">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={friend.avatar_url} />
              <AvatarFallback>
                {friend.first_name?.charAt(0)}{friend.last_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{friend.first_name} {friend.last_name}</p>
              <p className="text-sm text-muted-foreground">@{friend.username}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {type === 'friend' && (
              <Button size="sm" onClick={() => onMessage?.(friend.id)}>
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}
            
            {type === 'search' && (
              <Button size="sm" onClick={() => onAddFriend?.(friend.id)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
            
            {type === 'request-sent' && (
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            )}
            
            {type === 'request-received' && (
              <>
                <Button size="sm" onClick={() => onAcceptRequest?.(requestId!)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDeclineRequest?.(requestId!)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FriendCard;
