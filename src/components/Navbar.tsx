
import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { APP_NAME } from "@/constants/app";
import { Users } from "lucide-react";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Get admin status directly from JWT user object
  const isAdmin = user?.isBreeder || false;
  const isPetOwner = false; // This would need to be added to the user profile if needed

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="bg-card shadow-xl text-card-foreground sticky top-0 z-50 transition-shadow duration-300 hover:shadow-2xl">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-yellow-500 hover:text-yellow-400 transition-colors">
          {APP_NAME}
        </Link>
        <div className="flex items-center space-x-4">
          <Link to="/litters" className="text-muted-foreground hover:text-foreground">
            Litters
          </Link>
          <Link to="/upcoming-litters" className="text-muted-foreground hover:text-foreground">
            Upcoming
          </Link>
          <Link to="/blog" className="text-muted-foreground hover:text-foreground">
            Blog
          </Link>
          <Link to="/contact" className="text-muted-foreground hover:text-foreground">
            Contact
          </Link>
          <Link 
            to="/high-table" 
            className={`flex items-center gap-1 hover:text-foreground transition-colors ${
              isPetOwner 
                ? 'text-blue-600 font-medium' 
                : 'text-muted-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            High Table
            {isPetOwner && <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Active</span>}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          {session ? (
            <>
              <Link to="/profile" className="text-muted-foreground hover:text-foreground">
                Profile
              </Link>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link to="/auth">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
