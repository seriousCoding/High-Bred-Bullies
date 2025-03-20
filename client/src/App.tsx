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
import { ApiKeysProvider } from "@/context/ApiKeysContext";
import { MarketsProvider } from "@/context/MarketsContext";
import { AuthProvider } from "@/hooks/use-auth";
import { UnifiedAuthProvider } from "@/hooks/use-unified-auth";
import { ProtectedRoute, ApiKeyRequiredRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/unified-auth" component={UnifiedAuthPage} />
      <Route path="/api-key-auth" component={ApiKeyAuthPage} />
      <Route path="/auth/callback" component={OAuthCallback} />
      
      {/* Authentication Required Routes */}
      <ApiKeyRequiredRoute path="/add-api-key" component={AddApiKeyPage} />
      
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
