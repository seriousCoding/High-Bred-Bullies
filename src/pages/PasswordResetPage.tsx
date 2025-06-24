import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Mail, Lock, ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Email is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/password-reset/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reset code');
      }

      toast.success('Reset code sent! Check your email.');
      setStep('reset');
    } catch (error) {
      console.error('Password reset request error:', error);
      toast.error('Failed to send reset code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code || !newPassword || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/password-reset/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast.success('Password reset successfully! You can now log in.');
      navigate('/auth');
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 'reset' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('request')}
                  className="p-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 'request' ? 'Reset Password' : 'Enter Reset Code'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'request' ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Reset Code'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Reset Code</Label>
                  <Input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code from email"
                    maxLength={6}
                    className="text-center font-mono text-lg tracking-wider"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Didn't receive the code?{' '}
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => setStep('request')}
                  >
                    Send again
                  </Button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}