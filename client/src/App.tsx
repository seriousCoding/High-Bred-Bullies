import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Markets from "@/pages/Markets";
import Portfolio from "@/pages/Portfolio";
import Orders from "@/pages/Orders";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import OAuthCallback from "@/pages/OAuthCallback";
import AuthPage from "@/pages/auth-page";
import UnifiedAuthPage from "@/pages/unified-auth-page";
import ApiKeyAuthPage from "@/pages/api-key-auth";
import AddApiKeyPage from "@/pages/add-api-key";
import CoinbaseConnectPage from "@/pages/coinbase-connect";
import { ApiKeysProvider } from "@/context/ApiKeysContext";
import { MarketsProvider } from "@/context/MarketsContext";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { UnifiedAuthProvider } from "@/hooks/use-unified-auth";
import { ProtectedRoute, ApiKeyRequiredRoute } from "@/lib/protected-route";

const RouterWithAuth = () => {
  const { user } = useAuth();
  
  return (
    <Switch>
      {/* Public Routes - Always accessible */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/callback" component={OAuthCallback} />
      
      {/* Routes that require user login but not API keys */}
      {user ? (
        <>
          <Route path="/connect-coinbase" component={UnifiedAuthPage} />
          <Route path="/api-key-auth" component={ApiKeyAuthPage} />
          <Route path="/add-api-key" component={AddApiKeyPage} />
        </>
      ) : null}
      
      {/* Protected Routes (require auth + API keys) */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/markets" component={Markets} />
      <ProtectedRoute path="/portfolio" component={Portfolio} />
      <ProtectedRoute path="/orders" component={Orders} />
      <ProtectedRoute path="/history" component={History} />
      <ProtectedRoute path="/settings" component={Settings} />
      
      {/* Fallback Route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// Router needs to be inside the AuthProvider context to use the useAuth hook
function Router() {
  return (
    <Switch>
      {/* Public Routes - Always accessible */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/callback" component={OAuthCallback} />
      
      {/* All other routes should be protected and check for login */}
      <Route path="/connect-coinbase" component={CoinbaseConnectPage} />
      <Route path="/unified-auth" component={UnifiedAuthPage} />
      <Route path="/api-key-auth" component={ApiKeyAuthPage} />
      <Route path="/add-api-key" component={AddApiKeyPage} />
      
      {/* Dashboard and other pages */}
      <Route path="/markets" component={Markets} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/orders" component={Orders} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/" component={Dashboard} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UnifiedAuthProvider>
        <AuthProvider>
          <ApiKeysProvider>
            <MarketsProvider>
              <div className="min-h-screen bg-background text-foreground flex">
                <Router />
              </div>
              <Toaster />
            </MarketsProvider>
          </ApiKeysProvider>
        </AuthProvider>
      </UnifiedAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
