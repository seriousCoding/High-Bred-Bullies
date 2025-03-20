import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const { 
    user, 
    isLoading,
    loginMutation, 
    registerMutation 
  } = useAuth();

  // If user is already logged in, redirect to the dashboard
  if (user && !isLoading) {
    return <Redirect to="/" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === "login") {
      loginMutation.mutate({ username, password });
    } else {
      registerMutation.mutate({ username, password });
    }
  };

  const isSubmitting = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Hero/Info Section */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8 bg-gradient-to-br from-primary/20 to-background">
        <div className="mx-auto max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Coinbase Trading Dashboard
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Access real-time market data, manage your portfolio, and execute trades with a powerful, intuitive interface.
          </p>
          <div className="mt-10">
            <ul className="space-y-4">
              <li className="flex gap-2">
                <span>✓</span>
                <span>Connect directly to your Coinbase account</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Real-time market data and price charts</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Secure API key management</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Track your portfolio performance</span>
              </li>
              <li className="flex gap-2">
                <span>✓</span>
                <span>Execute trades with advanced order types</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Auth Form Section */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Tabs 
            defaultValue="login" 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as "login" | "register")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {activeTab === "login" ? "Welcome back" : "Create an account"}
                  </CardTitle>
                  <CardDescription>
                    {activeTab === "login" 
                      ? "Enter your credentials to access your account" 
                      : "Register to start using the Coinbase Trading Dashboard"}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </CardContent>
                
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {activeTab === "login" ? "Logging in..." : "Registering..."}
                      </>
                    ) : (
                      activeTab === "login" ? "Login" : "Register"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  );
}