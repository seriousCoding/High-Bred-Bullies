
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface HighTableInviteDialogProps {
  currentProfileId: string;
}

const HighTableInviteDialog: React.FC<HighTableInviteDialogProps> = ({ currentProfileId }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      // Send invitation via API
      const response = await fetch(`${API_BASE_URL}/api/high-table-invitations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inviter_id: currentProfileId,
          invited_email: email.trim().toLowerCase()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send invitation');
      }

      toast({
        title: result.isResend ? 'Invitation resent!' : 'Invitation sent!',
        description: `Invitation ${result.isResend ? 'resent to' : 'sent to'} ${email}`
      });

      setEmail('');
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to send invitation: ${error.message}`,
        variant: 'destructive'
      });
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Friends
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Friends to High Table</DialogTitle>
          <DialogDescription>
            Invite your friends to join the High Table pet community. They'll receive an email invitation. 
            If they already have an invitation, this will resend it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isLoading || !email.trim()}>
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HighTableInviteDialog;
