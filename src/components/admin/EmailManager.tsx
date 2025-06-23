import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Send, TestTube, Users, CheckCircle, AlertCircle } from 'lucide-react';

interface EmailManagerProps {
  className?: string;
}

const EmailManager: React.FC<EmailManagerProps> = ({ className }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ success: boolean; message: string } | null>(null);

  // Test email form state
  const [testEmail, setTestEmail] = useState({
    to: '',
    subject: 'Test Email from High Bred Bullies'
  });

  // Bulk email form state
  const [bulkEmail, setBulkEmail] = useState({
    subject: '',
    message: '',
    recipients: 'all_users' // all_users, breeders, customers
  });

  // Contact form test state
  const [contactTest, setContactTest] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const sendTestEmail = async () => {
    if (!testEmail.to) {
      setTestResult({ success: false, message: 'Please enter a recipient email address' });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/emails/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(testEmail)
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestResult({ 
          success: data.success, 
          message: data.message || (data.success ? 'Test email sent successfully!' : 'Failed to send test email')
        });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test email' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Network error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const testContactForm = async () => {
    if (!contactTest.name || !contactTest.email || !contactTest.message) {
      setBulkResult({ success: false, message: 'Please fill in all required fields' });
      return;
    }

    setIsLoading(true);
    setBulkResult(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactTest)
      });

      const data = await response.json();
      
      if (response.ok) {
        setBulkResult({ 
          success: true, 
          message: `Contact form submitted successfully! ID: ${data.id}`
        });
        setContactTest({ name: '', email: '', subject: '', message: '' });
      } else {
        setBulkResult({ success: false, message: data.error || 'Failed to submit contact form' });
      }
    } catch (error) {
      setBulkResult({ success: false, message: 'Network error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Management
          </CardTitle>
          <CardDescription>
            Send test emails, manage notifications, and test email functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="test" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="test">Test Email</TabsTrigger>
              <TabsTrigger value="contact">Contact Form</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="test" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="test-to">Recipient Email</Label>
                  <Input
                    id="test-to"
                    type="email"
                    placeholder="Enter recipient email address"
                    value={testEmail.to}
                    onChange={(e) => setTestEmail({ ...testEmail, to: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="test-subject">Subject</Label>
                  <Input
                    id="test-subject"
                    placeholder="Email subject"
                    value={testEmail.subject}
                    onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
                  />
                </div>

                <Button 
                  onClick={sendTestEmail} 
                  disabled={isLoading}
                  className="w-full"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isLoading ? 'Sending...' : 'Send Test Email'}
                </Button>

                {testResult && (
                  <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                      {testResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact-name">Name</Label>
                    <Input
                      id="contact-name"
                      placeholder="Your name"
                      value={contactTest.name}
                      onChange={(e) => setContactTest({ ...contactTest, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="Your email"
                      value={contactTest.email}
                      onChange={(e) => setContactTest({ ...contactTest, email: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    placeholder="Message subject"
                    value={contactTest.subject}
                    onChange={(e) => setContactTest({ ...contactTest, subject: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Your message"
                    rows={4}
                    value={contactTest.message}
                    onChange={(e) => setContactTest({ ...contactTest, message: e.target.value })}
                  />
                </div>

                <Button 
                  onClick={testContactForm} 
                  disabled={isLoading}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isLoading ? 'Submitting...' : 'Test Contact Form'}
                </Button>

                {bulkResult && (
                  <Alert className={bulkResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {bulkResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={bulkResult.success ? 'text-green-800' : 'text-red-800'}>
                      {bulkResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Available Email Templates</h3>
                
                <div className="grid gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Welcome Email</CardTitle>
                      <CardDescription>
                        Sent to new users when they register
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Includes platform introduction, feature overview, and getting started guide.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Order Confirmation</CardTitle>
                      <CardDescription>
                        Sent when a customer places an order
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Contains order details, payment confirmation, and next steps.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Breeder Notification</CardTitle>
                      <CardDescription>
                        Sent to breeders when they receive new orders
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Includes customer details, order information, and action items.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Contact Form Notification</CardTitle>
                      <CardDescription>
                        Sent to admin when contact form is submitted
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Contains all submitted form data for admin review.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailManager;