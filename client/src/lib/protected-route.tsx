import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, RouteComponentProps } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<RouteComponentProps>;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading, hasApiKeys } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        {(params) => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        {(params) => <Redirect to="/auth" />}
      </Route>
    );
  }

  if (!hasApiKeys) {
    return (
      <Route path={path}>
        {(params) => <Redirect to="/connect-coinbase" />}
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function ApiKeyRequiredRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading, hasApiKeys } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        {(params) => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        {(params) => <Redirect to="/auth" />}
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}