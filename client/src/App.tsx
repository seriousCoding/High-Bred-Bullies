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
          <Route path="/connect-coinbase" component={CoinbaseConnectPage} />
          <Route path="/unified-auth" component={UnifiedAuthPage} />
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
      <Route path="/auth">
        {(params) => <AuthPage {...params} />}
      </Route>
      <Route path="/auth/callback">
        {(params) => <OAuthCallback {...params} />}
      </Route>
      
      {/* All other routes should be protected and check for login */}
      <Route path="/connect-coinbase">
        {(params) => <CoinbaseConnectPage {...params} />}
      </Route>
      <Route path="/unified-auth">
        {(params) => <UnifiedAuthPage {...params} />}
      </Route>
      <Route path="/api-key-auth">
        {(params) => <ApiKeyAuthPage {...params} />}
      </Route>
      <Route path="/add-api-key">
        {(params) => <AddApiKeyPage {...params} />}
      </Route>
      
      {/* Dashboard and other pages */}
      <Route path="/markets">
        {(params) => <Markets {...params} />}
      </Route>
      <Route path="/portfolio">
        {(params) => <Portfolio {...params} />}
      </Route>
      <Route path="/orders">
        {(params) => <Orders {...params} />}
      </Route>
      <Route path="/history">
        {(params) => <History {...params} />}
      </Route>
      <Route path="/settings">
        {(params) => <Settings {...params} />}
      </Route>
      <Route path="/">
        {(params) => <Dashboard {...params} />}
      </Route>
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
