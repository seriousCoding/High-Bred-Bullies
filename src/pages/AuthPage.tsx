import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { PasswordInput } from '@/components/PasswordInput';
import { useAuth } from '@/hooks/useAuth';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();

  useEffect(() => {
    console.log("AuthPage: user state changed:", user);
    if (user) {
      console.log("User authenticated, navigating to /");
      navigate('/');
    }
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', { email, password, isLogin });
    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }



    try {
      let result;
      if (isLogin) {
        result = await signIn(email, password);
        if (result && !result.error) {
          toast({ title: 'Success', description: 'Logged in successfully!' });
          // Force navigation after successful login
          setTimeout(() => navigate('/'), 100);
        }
      } else {
        result = await signUp(email, password);
        if (result && !result.error) {
          toast({ title: 'Success', description: 'Registration successful!' });
          // Force navigation after successful signup
          setTimeout(() => navigate('/'), 100);
        }
      }
      
      if (result && result.error) {
        throw result.error;
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: 'Authentication Error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    // Already navigated by useEffect, this is a fallback or quick render scenario
    return <div className="flex justify-center items-center min-h-screen"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <img 
              src="/lovable-uploads/ef228263-d2fc-4f20-9e5e-2f2ec7a0a7b1.png" 
              alt="High Bred Bullies Logo"
              className="h-32 w-auto"
            />
          </div>
          <CardTitle className="text-3xl font-bold">{isLogin ? 'Welcome Back!' : 'Create Account'}</CardTitle>
          <CardDescription>{isLogin ? 'Sign in to continue to High Bred Bullies.' : 'Join our community of happy pet owners.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base"
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="text-base"
                />
              </div>
            )}
            <Button 
              type="submit" 
              size="lg" 
              className="w-full" 
              disabled={loading}
              onClick={(e) => {
                console.log('Button clicked directly');
                e.preventDefault();
                handleAuth(e);
              }}
            >
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <Button variant="link" onClick={() => {
            console.log('Toggle button clicked, current isLogin:', isLogin);
            setIsLogin(!isLogin);
          }} className="text-sm">
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AuthPage;
