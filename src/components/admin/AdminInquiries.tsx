
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
const API_BASE_URL = window.location.origin;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface InquiryWithProfile {
  id: string;
  user_id: string | null;
  litter_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  response: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const fetchInquiries = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/inquiries`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch inquiries');
  return await response.json();
};

export const AdminInquiries = () => {
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryWithProfile | null>(null);
  const [response, setResponse] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: inquiries, isLoading, error } = useQuery({
    queryKey: ['adminInquiries'],
    queryFn: fetchInquiries,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ inquiryId, responseText }: { inquiryId: string, responseText: string }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/inquiries/${inquiryId}/reply`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reply: responseText }),
      });
      if (!response.ok) throw new Error('Failed to reply to inquiry');
    },
    onSuccess: () => {
      toast.success("Response sent successfully!");
      queryClient.invalidateQueries({ queryKey: ['adminInquiries'] });
      setIsDialogOpen(false);
      setResponse('');
      setSelectedInquiry(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to send response: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/inquiries/${inquiryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete inquiry');
      return inquiryId;
    },
    onSuccess: (deletedId) => {
      toast.success("Inquiry deleted successfully!");
      // Update the cache by removing the deleted inquiry
      queryClient.setQueryData(['adminInquiries'], (oldData: InquiryWithProfile[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(inquiry => inquiry.id !== deletedId);
      });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete inquiry: ${error.message}`);
    }
  });

  const handleRespond = (inquiry: InquiryWithProfile) => {
    setSelectedInquiry(inquiry);
    setResponse(inquiry.response || '');
    setIsDialogOpen(true);
  };

  const handleDelete = async (inquiryId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this inquiry? This action cannot be undone.");
    
    if (confirmed) {
      deleteMutation.mutate(inquiryId);
    }
  };

  const handleSendResponse = () => {
    if (!selectedInquiry || !response.trim()) return;
    respondMutation.mutate({ 
      inquiryId: selectedInquiry.id, 
      responseText: response.trim() 
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Manage Inquiries</CardTitle>
          <CardDescription>View and respond to customer inquiries.</CardDescription>
        </CardHeader>
        <CardContent>
          {inquiries && inquiries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell className="font-medium">{inquiry.name || 'N/A'}</TableCell>
                    <TableCell>{inquiry.email || 'N/A'}</TableCell>
                    <TableCell>{inquiry.subject}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        inquiry.status === 'responded' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {inquiry.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(inquiry.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRespond(inquiry)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          {inquiry.response ? 'Edit Response' : 'Respond'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(inquiry.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground">No inquiries found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Inquiry</DialogTitle>
          </DialogHeader>
          
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Original Message</h4>
                <p><strong>From:</strong> {selectedInquiry.name || 'N/A'} ({selectedInquiry.email || 'N/A'})</p>
                <p><strong>Subject:</strong> {selectedInquiry.subject}</p>
                <p className="mt-2">{selectedInquiry.message}</p>
              </div>

              <div>
                <Label htmlFor="response">Your Response</Label>
                <Textarea
                  id="response"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Type your response here..."
                  className="min-h-[200px] mt-2"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendResponse}
                  disabled={!response.trim() || respondMutation.isPending}
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Response
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
