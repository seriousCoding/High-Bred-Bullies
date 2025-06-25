import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useApiKeys } from "@/hooks/use-api-keys";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { apiKey, apiSecret, hasKeys, clearKeys } = useApiKeys();
  const { toast } = useToast();
  
  // New key form state
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeySecret, setNewKeySecret] = useState("");
  const [showNewKeySecret, setShowNewKeySecret] = useState(false);
  
  // Settings toggles
  const [settings, setSettings] = useState({
    realTimeUpdates: true,
    tradingConfirmation: true,
    priceAlerts: false,
    nightMode: true
  });
  
  // Fetch saved API keys
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['/api/keys'],
    queryFn: async () => {
      const res = await fetch('/api/keys');
      
      if (!res.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      return res.json();
    }
  });
  
  // Store new API key
  const storeKeyMutation = useMutation({
    mutationFn: async (data: { apiKey: string; apiSecret: string; label: string }) => {
      return apiRequest("POST", "/api/keys", {
        userId: 1, // In a real app, this would come from auth
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        label: data.label
      });
    },
    onSuccess: () => {
      toast({
        title: "API key saved",
        description: "Your API key has been stored successfully",
        variant: "default"
      });
      
      // Clear form
      setNewKeyName("");
      setNewKeyValue("");
      setNewKeySecret("");
      
      // Refresh keys list
      queryClient.invalidateQueries({ queryKey: ['/api/keys'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save API key",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
    }
  });
  
  // Delete API key
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      return apiRequest("DELETE", `/api/keys/${keyId}`, null);
    },
    onSuccess: () => {
      toast({
        title: "API key deleted",
        description: "Your API key has been removed",
        variant: "default"
      });
      
      // Refresh keys list
      queryClient.invalidateQueries({ queryKey: ['/api/keys'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete API key",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
    }
  });
  
  // Handle new key submission
  const handleSaveKey = () => {
    if (!newKeyName || !newKeyValue || !newKeySecret) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    
    storeKeyMutation.mutate({
      label: newKeyName,
      apiKey: newKeyValue,
      apiSecret: newKeySecret
    });
  };
  
  // Handle key deletion
  const handleDeleteKey = (keyId: number) => {
    if (window.confirm("Are you sure you want to delete this API key?")) {
      deleteKeyMutation.mutate(keyId);
    }
  };
  
  // Handle disconnect
  const handleDisconnect = () => {
    if (window.confirm("Are you sure you want to disconnect your API keys?")) {
      clearKeys();
      toast({
        title: "API keys disconnected",
        description: "Your API keys have been removed from this session",
        variant: "default"
      });
    }
  };

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onApiKeyModalOpen={() => setIsApiKeyModalOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-4 p-4">
            {/* API Keys Section */}
            <div className="col-span-12 lg:col-span-8 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-4 border-b border-[#3A3A3A]">
                <h2 className="text-xl font-medium text-white mb-1">API Keys</h2>
                <p className="text-sm text-gray-400">
                  Manage your Coinbase Advanced Trade API keys. These keys are used to connect to your Coinbase account.
                </p>
              </div>
              
              <div className="p-4 divide-y divide-[#3A3A3A]">
                {hasKeys && (
                  <div className="pb-4">
                    <h3 className="text-md font-medium text-white mb-2">Current Connection</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">Active API Key</div>
                        <div className="text-xs text-gray-400">
                          {apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'Not connected'}
                        </div>
                      </div>
                      <div>
                        <Button 
                          variant="destructive" 
                          onClick={handleDisconnect}
                          className="bg-red-900 hover:bg-red-800 text-white"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="py-4">
                  <h3 className="text-md font-medium text-white mb-3">Saved API Keys</h3>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#0052FF]"></div>
                    </div>
                  ) : !apiKeys || apiKeys.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      <p>No saved API keys</p>
                      <p className="text-xs mt-1">Add a new key below or connect directly</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeys.map((key: any) => (
                        <div key={key.id} className="flex items-center justify-between bg-dark-bg rounded-md p-3">
                          <div>
                            <div className="text-sm font-medium text-white">{key.label || "Unnamed Key"}</div>
                            <div className="text-xs text-gray-400">
                              {key.apiKeyPreview} • Created {new Date(key.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                // In a real app, you'd use this key
                                toast({
                                  title: "Functionality limited",
                                  description: "Using saved keys requires server-side session management",
                                  variant: "default"
                                });
                              }}
                              className="border-[#3A3A3A] text-white hover:bg-[#3A3A3A]"
                            >
                              Use
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteKey(key.id)}
                              className="bg-transparent text-[#FF3B30] hover:bg-red-900 hover:bg-opacity-20"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="pt-4">
                  <h3 className="text-md font-medium text-white mb-3">Add New API Key</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="key-name" className="text-sm text-gray-400">Key Name</Label>
                      <Input
                        id="key-name"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., Trading Key"
                        className="bg-dark-bg border-[#3A3A3A] text-white focus:ring-[#0052FF] focus:border-[#0052FF]"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="api-key" className="text-sm text-gray-400">API Key</Label>
                      <Input
                        id="api-key"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder="Enter your Coinbase API key"
                        className="bg-dark-bg border-[#3A3A3A] text-white focus:ring-[#0052FF] focus:border-[#0052FF]"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="api-secret" className="text-sm text-gray-400">API Secret</Label>
                      <div className="relative">
                        <Input
                          id="api-secret"
                          type={showNewKeySecret ? "text" : "password"}
                          value={newKeySecret}
                          onChange={(e) => setNewKeySecret(e.target.value)}
                          placeholder="Enter your Coinbase API secret"
                          className="bg-dark-bg border-[#3A3A3A] text-white focus:ring-[#0052FF] focus:border-[#0052FF] pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          onClick={() => setShowNewKeySecret(!showNewKeySecret)}
                        >
                          <span className="material-icons text-base">
                            {showNewKeySecret ? "visibility" : "visibility_off"}
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <Button 
                        onClick={handleSaveKey}
                        disabled={storeKeyMutation.isPending || !newKeyName || !newKeyValue || !newKeySecret}
                        className="bg-[#0052FF] text-white hover:bg-blue-600"
                      >
                        {storeKeyMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          'Save API Key'
                        )}
                      </Button>
                    </div>
                    
                    <div className="bg-[#0052FF] bg-opacity-10 text-[#0052FF] text-sm p-3 rounded-md flex items-start">
                      <span className="material-icons text-base mr-2 mt-0.5">info</span>
                      <span>
                        To create API keys, go to your Coinbase Advanced Trade account settings and create a new API key with appropriate permissions.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* App Settings Section */}
            <div className="col-span-12 lg:col-span-4 bg-card-bg rounded-lg overflow-hidden border border-[#3A3A3A]">
              <div className="p-4 border-b border-[#3A3A3A]">
                <h2 className="text-xl font-medium text-white mb-1">App Settings</h2>
                <p className="text-sm text-gray-400">
                  Configure your app preferences
                </p>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Real-time updates</div>
                    <div className="text-xs text-gray-400">Receive live market data via WebSocket</div>
                  </div>
                  <Switch 
                    checked={settings.realTimeUpdates} 
                    onCheckedChange={(checked) => setSettings({...settings, realTimeUpdates: checked})}
                    className="data-[state=checked]:bg-[#0052FF]"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Trading confirmations</div>
                    <div className="text-xs text-gray-400">Confirm before executing trades</div>
                  </div>
                  <Switch 
                    checked={settings.tradingConfirmation} 
                    onCheckedChange={(checked) => setSettings({...settings, tradingConfirmation: checked})}
                    className="data-[state=checked]:bg-[#0052FF]"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Price alerts</div>
                    <div className="text-xs text-gray-400">Notify on significant price movements</div>
                  </div>
                  <Switch 
                    checked={settings.priceAlerts} 
                    onCheckedChange={(checked) => setSettings({...settings, priceAlerts: checked})}
                    className="data-[state=checked]:bg-[#0052FF]"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Night mode</div>
                    <div className="text-xs text-gray-400">Use dark theme for the application</div>
                  </div>
                  <Switch 
                    checked={settings.nightMode} 
                    onCheckedChange={(checked) => setSettings({...settings, nightMode: checked})}
                    className="data-[state=checked]:bg-[#0052FF]"
                  />
                </div>
                
                <div className="pt-2">
                  <Button 
                    onClick={() => {
                      toast({
                        title: "Settings saved",
                        description: "Your preferences have been updated",
                        variant: "default"
                      });
                    }}
                    className="bg-[#0052FF] text-white hover:bg-blue-600 w-full"
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        {/* API Key Modal */}
        <ApiKeyModal 
          isOpen={isApiKeyModalOpen} 
          onClose={() => setIsApiKeyModalOpen(false)}
        />
      </div>
    </>
  );
}
