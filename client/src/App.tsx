import React from "react";
import { Switch, Route, useLocation, useRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Markets from "@/pages/Markets";
import Portfolio from "@/pages/Portfolio";
import Orders from "@/pages/Orders";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import OAuthCallback from "@/pages/OAuthCallback";
import { ApiKeysProvider } from "@/context/ApiKeysContext";
import { MarketsProvider } from "@/context/MarketsContext";

// Wrapper component to handle OAuth redirect fallbacks
function OAuthHandler({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    // Check if this is an OAuth callback redirect to the root page
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (params.has('oauth') && params.get('oauth') === 'complete') {
      // This is a fallback redirect from a failed OAuth callback
      console.log('Detected OAuth redirect to root route');
      
      const code = params.get('code');
      const state = params.get('state');
      
      if (code && state) {
        console.log('OAuth data found in URL, redirecting to proper callback handler');
        // Store data for the callback component
        localStorage.setItem('oauth_code', code);
        localStorage.setItem('auth_state_key', state);
        
        // Navigate to the OAuth callback page
        window.history.replaceState({}, document.title, '/'); // Clean up URL
        navigate('/auth/callback');
      } else {
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: "Could not complete the authentication process. Please try again.",
        });
      }
    }

    // Handle error parameters from OAuth process
    if (params.has('error')) {
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: errorDescription || error || "An error occurred during authentication",
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
    }
  }, [navigate, toast]);

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/markets" component={Markets} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/orders" component={Orders} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/auth/callback" component={OAuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiKeysProvider>
        <MarketsProvider>
          <OAuthHandler>
            <div className="min-h-screen bg-dark-bg text-gray-200 flex">
              <Router />
            </div>
            <Toaster />
          </OAuthHandler>
        </MarketsProvider>
      </ApiKeysProvider>
    </QueryClientProvider>
  );
}

export default App;
