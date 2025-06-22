
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
      // First check if invitation already exists
      const { data: existingInvite } = await supabase
        .from('high_table_invitations')
        .select('id')
        .eq('invited_email', email.trim().toLowerCase())
        .single();

      if (existingInvite) {
        // Update existing invitation (resend)
        const { error } = await supabase
          .from('high_table_invitations')
          .update({ 
            inviter_id: currentProfileId,
            created_at: new Date().toISOString()
          })
          .eq('invited_email', email.trim().toLowerCase());

        if (error) throw error;

        toast({
          title: 'Invitation resent!',
          description: `Invitation resent to ${email}`
        });
      } else {
        // Create new invitation
        const { error } = await supabase
          .from('high_table_invitations')
          .insert({
            inviter_id: currentProfileId,
            invited_email: email.trim().toLowerCase()
          });

        if (error) throw error;

        toast({
          title: 'Invitation sent!',
          description: `Invitation sent to ${email}`
        });
      }

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
