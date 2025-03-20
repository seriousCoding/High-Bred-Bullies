import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useApiKeys } from "@/hooks/use-api-keys";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VaultedApiKey } from "@/lib/apiKeyVault";

// Form schema for adding API keys with validation
const apiKeyFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  apiKey: z.string()
    .min(10, "API Key must be at least 10 characters"),
  apiSecret: z.string()
    .min(20, "API Secret must be at least 20 characters"),
});

// Form schema for client API key (pre-filled)
const clientKeyFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  clientApiKey: z.string().min(10, "API Key must be at least 10 characters"),
});

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  // Modal state
  const [activeTab, setActiveTab] = React.useState<string>("api-key");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  
  // Get API key context
  const { 
    addKey, 
    allApiKeys, 
    selectKey, 
    removeKey, 
    currentKey, 
    isAuthenticated, 
    isLoading,
    initiateOAuthFlow 
  } = useApiKeys();
  
  // Form for the API key
  const apiKeyForm = useForm<z.infer<typeof apiKeyFormSchema>>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      label: "My Coinbase API Key",
      apiKey: "",
      apiSecret: "",
    },
  });
  
  // Form for client API key (pre-filled)
  const clientKeyForm = useForm<z.infer<typeof clientKeyFormSchema>>({
    resolver: zodResolver(clientKeyFormSchema),
    defaultValues: {
      label: "Coinbase Client API Key",
      clientApiKey: "3RCxCpxADj5jSHikSRv6HSv2dOMjjakb", // Pre-filled
    },
  });
  
  // Clear form errors when modal is opened
  React.useEffect(() => {
    if (isOpen) {
      setError("");
      apiKeyForm.reset();
      clientKeyForm.reset();
    }
  }, [isOpen]);
  
  // Close modal after successful authentication
  React.useEffect(() => {
    if (isAuthenticated && isOpen && !isLoading) {
      onClose();
    }
  }, [isAuthenticated, isOpen, isLoading, onClose]);
  
  // Handle API key form submission
  const onSubmitApiKey = async (values: z.infer<typeof apiKeyFormSchema>) => {
    setIsSubmitting(true);
    setError("");
    
    try {
      await addKey(values.label, values.apiKey, values.apiSecret);
      onClose();
    } catch (error) {
      console.error("Error adding API key:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to add API key. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle client API key form submission
  const onSubmitClientKey = async (values: z.infer<typeof clientKeyFormSchema>) => {
    setIsSubmitting(true);
    setError("");
    
    try {
      await addKey(values.label, values.clientApiKey, "client-key");
      onClose();
    } catch (error) {
      console.error("Error adding client API key:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to add client API key. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Legacy OAuth flow handler
  const handleConnectWithCoinbase = async () => {
    setIsSubmitting(true);
    setError("");
    
    try {
      await initiateOAuthFlow();
    } catch (error) {
      console.error("Error initiating OAuth flow:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to start authentication flow. Please try again.");
      }
      setIsSubmitting(false);
    }
  };
  
  // Render the stored API keys list
  const renderApiKeysList = () => {
    if (allApiKeys.length === 0) {
      return (
        <div className="py-6 text-center text-gray-400">
          <p>No API keys stored yet.</p>
          <p className="text-sm mt-1">Add a new key using the form above.</p>
        </div>
      );
    }
    
    return (
      <div className="mt-4 space-y-3">
        <h3 className="font-medium text-white text-sm">Your Stored API Keys</h3>
        {allApiKeys.map((key: VaultedApiKey) => (
          <div 
            key={key.id} 
            className={`p-3 rounded-md border flex justify-between items-center
              ${key.id === currentKey?.id 
                ? 'bg-blue-900 bg-opacity-20 border-blue-700' 
                : 'bg-gray-800 bg-opacity-30 border-gray-700'}`
            }
          >
            <div>
              <div className="flex items-center">
                <span className="font-medium text-white">{key.label}</span>
                {key.id === currentKey?.id && (
                  <span className="ml-2 text-xs bg-blue-700 px-1.5 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1 flex items-center">
                <span>Key: {key.apiKey.substring(0, 6)}...{key.apiKey.substring(key.apiKey.length - 4)}</span>
                <span className="mx-2">•</span>
                <span>Added: {new Date(key.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex space-x-2">
              {key.id !== currentKey?.id && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-8 px-2 text-xs border-gray-600"
                  onClick={() => selectKey(key.id)}
                >
                  Use
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline"
                className="h-8 px-2 text-xs text-red-500 border-red-800 hover:bg-red-900 hover:bg-opacity-20"
                onClick={() => removeKey(key.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-white">Connect to Coinbase</DialogTitle>
          <DialogDescription className="text-gray-300">
            Connect your Coinbase account to access trading data and market information.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-900 bg-opacity-20 text-red-400 text-sm p-3 rounded-md flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <Tabs defaultValue="api-key" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="api-key">API Key</TabsTrigger>
            <TabsTrigger value="client-key">Client Key</TabsTrigger>
            <TabsTrigger value="saved-keys">Saved Keys</TabsTrigger>
          </TabsList>
          
          {/* API Key Tab */}
          <TabsContent value="api-key">
            <Form {...apiKeyForm}>
              <form onSubmit={apiKeyForm.handleSubmit(onSubmitApiKey)} className="space-y-4 py-2">
                <FormField
                  control={apiKeyForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="My Trading API Key" className="bg-gray-900" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs text-gray-500">
                        A name to identify this API key
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
                        <Input placeholder="Enter your Coinbase API Key" className="bg-gray-900 font-mono text-sm" {...field} />
                      </FormControl>
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
                          className="bg-gray-900 font-mono text-sm" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      "Connect with API Key"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
            
            <div className="pt-4 text-xs text-gray-400">
              <p>Need to create an API key? Visit your <a href="https://exchange.coinbase.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Coinbase Exchange API settings</a> to generate one.</p>
            </div>
          </TabsContent>
          
          {/* Client Key Tab */}
          <TabsContent value="client-key">
            <Form {...clientKeyForm}>
              <form onSubmit={clientKeyForm.handleSubmit(onSubmitClientKey)} className="space-y-4 py-2">
                <FormField
                  control={clientKeyForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Client API Key" className="bg-gray-900" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs text-gray-500">
                        A name to identify this API key
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={clientKeyForm.control}
                  name="clientApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client API Key</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Client API Key" 
                          className="bg-gray-900 font-mono text-sm" 
                          {...field} 
                          disabled
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-gray-500">
                        This is a pre-configured client API key
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      "Use Client API Key"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
            
            <div className="bg-amber-900 bg-opacity-20 text-amber-400 text-sm p-3 rounded-md mt-4 flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                This is a pre-configured client API key with limited functionality. For full trading capabilities, use your own API key.
              </span>
            </div>
          </TabsContent>
          
          {/* Saved Keys Tab */}
          <TabsContent value="saved-keys">
            {renderApiKeysList()}
            
            <div className="pt-4 flex justify-end space-x-2">
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                onClick={() => setActiveTab("api-key")}
              >
                Add New Key
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Legacy OAuth option at the bottom */}
        <div className="pt-4 border-t border-gray-800 mt-4">
          <p className="text-xs text-gray-400 mb-2">Alternatively, you can try connecting with OAuth:</p>
          <Button
            variant="outline"
            onClick={handleConnectWithCoinbase}
            disabled={isSubmitting}
            className="w-full border-[#0052FF] text-[#0052FF] hover:bg-[#0052FF] hover:bg-opacity-10"
          >
            {isSubmitting ? "Redirecting..." : "Connect with Coinbase OAuth"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
