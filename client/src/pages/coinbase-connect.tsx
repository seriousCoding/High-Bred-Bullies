import React, { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Validation schemas
const apiKeySchema = z.object({
  label: z.string().min(1, 'Label is required'),
  apiKey: z.string().min(10, 'API Key must be at least 10 characters'),
  apiSecret: z.string().min(10, 'API Secret must be at least 10 characters'),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

export default function CoinbaseConnectPage() {
  const [activeTab, setActiveTab] = useState<string>('api-key');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Initialize the API key form
  const apiKeyForm = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      label: 'My Coinbase API Key',
      apiKey: '',
      apiSecret: '',
    },
  });

  // Handle API key form submission
  const onApiKeySubmit = async (values: ApiKeyFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await apiRequest('POST', '/api/keys', {
        userId: user?.id,
        label: values.label,
        apiKey: values.apiKey,
        apiSecret: values.apiSecret,
        isActive: true,
      });

      if (response.ok) {
        toast({
          title: 'API Key Connected',
          description: 'Your Coinbase API key has been successfully connected.',
        });
        navigate('/');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to connect API key');
      }
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Coinbase',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OAuth login
  const handleOAuthLogin = async () => {
    setIsSubmitting(true);
    try {
      // Get the OAuth URL from the server
      const response = await fetch('/api/oauth/init');
      const data = await response.json();
      
      if (data.auth_url) {
        // For Replit environment, we need a special approach for OAuth
        // Open the OAuth URL in a popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.auth_url,
          'coinbase-oauth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        
        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // Popup was blocked, show alternate method
          window.location.href = '/redirect.html?auth_url=' + encodeURIComponent(data.auth_url);
        }
        
        // Listen for message from popup
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'oauth_success') {
            toast({
              title: 'Coinbase Connected',
              description: 'Your Coinbase account has been successfully connected.',
            });
            navigate('/');
          }
        }, { once: true });
      } else {
        throw new Error('Failed to get OAuth URL');
      }
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Coinbase',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  // Redirect to home if user is not logged in
  if (!user) {
    return navigate('/auth');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Connect to Coinbase
          </CardTitle>
          <CardDescription className="text-center">
            Choose your preferred connection method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="api-key"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="api-key">API Key</TabsTrigger>
              <TabsTrigger value="oauth">OAuth</TabsTrigger>
            </TabsList>

            <TabsContent value="api-key">
              <Form {...apiKeyForm}>
                <form
                  onSubmit={apiKeyForm.handleSubmit(onApiKeySubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={apiKeyForm.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Label</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="My Trading Key"
                            {...field}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          A name to help you identify this API key
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={apiKeyForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your Coinbase API Key"
                            {...field}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          Your Coinbase API Key from the Advanced Trade section
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={apiKeyForm.control}
                    name="apiSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your Coinbase API Secret"
                            {...field}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          Your Coinbase API Secret (we'll encrypt this)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect API Key"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="oauth">
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-950">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Connect your Coinbase account using OAuth for a seamless experience. This method is recommended for most users.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleOAuthLogin}
                  className="w-full bg-[#0052FF] hover:bg-[#0039B3]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg
                        className="mr-2 h-5 w-5"
                        viewBox="0 0 1024 1024"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                      >
                        <path d="M512 0C229.376 0 0 229.376 0 512s229.376 512 512 512 512-229.376 512-512S794.624 0 512 0z m0 938.666667C276.352 938.666667 85.333333 747.648 85.333333 512S276.352 85.333333 512 85.333333s426.666667 191.018667 426.666667 426.666667-191.018667 426.666667-426.666667 426.666667z" />
                        <path d="M512 256C370.688 256 256 370.688 256 512s114.688 256 256 256 256-114.688 256-256-114.688-256-256-256z" />
                      </svg>
                      Connect with Coinbase
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Need help? <a href="https://help.coinbase.com/en/contact-us" target="_blank" className="text-blue-600 dark:text-blue-400 underline">Contact Coinbase Support</a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}