import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Loader2 } from 'lucide-react';

// Simple validation schema that doesn't restrict format
const formSchema = z.object({
  label: z.string().min(1, "Label is required"),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
});

export default function ApiKeyAuthPage() {
  const [location, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "My Coinbase API Key",
      apiKey: "",
      apiSecret: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
      // Use direct fetch with credentials to ensure cookies are sent
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Important for session cookies
        body: JSON.stringify({
          userId: 1, // The server should get this from session
          label: values.label,
          apiKey: values.apiKey,
          apiSecret: values.apiSecret,
          priority: 1 // Default priority
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add API key');
      }
      
      const data = await response.json();
      
      toast({
        title: "API Key Added",
        description: "Your Coinbase API key has been added successfully.",
      });
      
      // Redirect to the dashboard
      navigate('/');
    } catch (error) {
      console.error('Error adding API key:', error);
      toast({
        title: "Failed to add API key",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute left-4 top-4 text-gray-400"
            onClick={() => navigate('/unified-auth')}
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="text-center pt-4">
            <CardTitle className="text-white text-xl">API Key Authentication</CardTitle>
            <CardDescription className="text-gray-400">
              Enter your Coinbase Advanced Trade API credentials
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Label</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="My Trading API Key" 
                        className="bg-gray-700 border-gray-600 text-white"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      A name to identify this API key
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">API Key</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your Coinbase API Key" 
                        className="bg-gray-700 border-gray-600 text-white font-mono text-sm"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      Your Coinbase Advanced Trade API key
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apiSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">API Secret</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Enter your Coinbase API Secret" 
                        className="bg-gray-700 border-gray-600 text-white font-mono text-sm"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-gray-400">
                      Your Coinbase Advanced Trade API secret
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : "Connect with API Key"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-gray-400">
            <p>Need to create an API key? Visit your <a href="https://exchange.coinbase.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Coinbase Exchange API settings</a> to generate one.</p>
          </div>
          <div className="text-xs text-gray-500">
            <p>Your API key and secret are securely stored and used only for connecting to Coinbase APIs. We recommend using API keys with read-only permissions for better security.</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}