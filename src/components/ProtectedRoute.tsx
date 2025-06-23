import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireBreeder?: boolean;
}

const ProtectedRoute = ({ children, requireBreeder = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  console.log('ProtectedRoute: Auth state check:', { user: user ? 'present' : 'null', loading, requireBreeder });

  if (loading) {
    console.log('ProtectedRoute: Still loading, showing spinner');
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user found, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  if (requireBreeder && !user.isBreeder) {
    console.log('ProtectedRoute: User not a breeder, redirecting to /');
    return <Navigate to="/" replace />;
  }

  console.log('ProtectedRoute: Access granted for user:', user.username);
  return <>{children}</>;
};

export default ProtectedRoute;