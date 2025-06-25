import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function AddApiKeyPage() {
  const [label, setLabel] = useState("My Coinbase API Key");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { toast } = useToast();
  const { user, hasApiKeys } = useAuth();
  const [, setLocation] = useLocation();

  // If user is not logged in, redirect to auth page
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // If they already have API keys and this isn't a forced add, we can go to home
  if (hasApiKeys && !isSuccess) {
    return <Redirect to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      toast({
        title: "Missing fields",
        description: "Please provide both API key and secret",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        label,
        apiKey,
        apiSecret,
      };
      
      const res = await apiRequest("POST", "/api/keys", payload);
      const data = await res.json();
      
      toast({
        title: "API Key Added",
        description: "Your Coinbase API key has been added successfully",
      });
      setIsSuccess(true);
      
      // Refetch the user data to update the hasApiKeys status
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Clear sensitive form data
      setApiKey("");
      setApiSecret("");
      
      // Wait a moment before redirecting so the user sees the success state
      setTimeout(() => {
        setLocation("/");
      }, 1500);
    } catch (error) {
      toast({
        title: "Error adding API key",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <KeyRound className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-center">
              {isSuccess ? "API Key Added Successfully" : "Add Your Coinbase API Key"}
            </CardTitle>
            <CardDescription className="text-center">
              {isSuccess 
                ? "Your API key has been securely stored. Redirecting to dashboard..." 
                : "Connect your Coinbase account by adding your API credentials"}
            </CardDescription>
          </CardHeader>
          
          {isSuccess ? (
            <CardContent className="flex flex-col items-center justify-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-center text-muted-foreground">
                Successfully verified and stored your API key
              </p>
              <Button
                className="mt-4"
                onClick={() => setLocation("/")}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Key Label</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="My Trading Key"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your Coinbase API Key"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <div className="relative">
                    <Input
                      id="apiSecret"
                      type={showSecret ? "text" : "password"}
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="Your Coinbase API Secret"
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your API secret is stored securely and never shared
                  </p>
                </div>

                <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                  <h4 className="font-medium">How to get API keys from Coinbase:</h4>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Log in to your Coinbase account</li>
                    <li>Go to Settings {'>'} API</li>
                    <li>Create a new API key with "trade" permissions</li>
                    <li>Copy the API key and secret</li>
                    <li>Paste them into the fields above</li>
                  </ol>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying API Key...
                    </>
                  ) : (
                    "Add API Key"
                  )}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}