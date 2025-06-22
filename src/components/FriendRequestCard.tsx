
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, UserPlus } from 'lucide-react';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
import { toast } from 'sonner';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: {
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  receiver?: {
    username: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface FriendRequestCardProps {
  request: FriendRequest;
  currentUserId: string;
  onUpdate: () => void;
}

const FriendRequestCard: React.FC<FriendRequestCardProps> = ({ request, currentUserId, onUpdate }) => {
  const isReceived = request.receiver_id === currentUserId;
  const otherUser = isReceived ? request.sender : request.receiver;
  
  const handleAccept = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests/${request.id}`, {
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
      onUpdate();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
    }
  };

  const handleDecline = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests/${request.id}`, {
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
      
      toast.success('Friend request declined');
      onUpdate();
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast.error('Failed to decline friend request');
    }
  };

  const handleCancel = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/friend-requests/${request.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel friend request: ${response.statusText}`);
      }
      
      toast.success('Friend request cancelled');
      onUpdate();
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      toast.error('Failed to cancel friend request');
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={otherUser?.avatar_url} />
              <AvatarFallback>
                {otherUser?.first_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {otherUser?.first_name} {otherUser?.last_name}
              </p>
              <p className="text-sm text-muted-foreground">
                @{otherUser?.username}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isReceived && request.status === 'pending' && (
              <>
                <Button size="sm" onClick={handleAccept} className="flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={handleDecline} className="flex items-center gap-1">
                  <X className="h-4 w-4" />
                  Decline
                </Button>
              </>
            )}
            
            {!isReceived && request.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={handleCancel}>
                Cancel Request
              </Button>
            )}
            
            {request.status === 'accepted' && (
              <span className="text-sm text-green-600 font-medium">Friends</span>
            )}
            
            {request.status === 'declined' && (
              <span className="text-sm text-red-600 font-medium">Declined</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FriendRequestCard;
