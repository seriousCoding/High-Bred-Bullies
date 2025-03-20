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
import { ApiKeysProvider } from "@/context/ApiKeysContext";
import { MarketsProvider } from "@/context/MarketsContext";

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
          <div className="min-h-screen bg-dark-bg text-gray-200 flex">
            <Router />
          </div>
          <Toaster />
        </MarketsProvider>
      </ApiKeysProvider>
    </QueryClientProvider>
  );
}

export default App;
