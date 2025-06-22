import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2, MessageSquare, User, Crown, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

const ProfilePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use relative URLs when running on Replit, localhost for local development
  const API_BASE_URL = window.location.hostname.includes('replit.dev') ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['newsletter-subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      // For now, return empty subscription data - this would be implemented when newsletter feature is added
      return { subscribed: false };
    },
    enabled: !!user,
  });

  const profileMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!user) throw new Error("User not authenticated");
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated successfully!");
    },
    onError: (error: any) => toast.error(`Failed to update profile: ${error.message}`),
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (preferences: any) => {
        if (!user) throw new Error("User not authenticated");
        
        const response = await fetch(`${API_BASE_URL}/api/newsletter-preferences`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ preferences })
        });
        if (!response.ok) throw new Error('Failed to update preferences');
        return response.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['newsletter-subscription', user?.id]});
        toast.success("Notification preferences updated!");
    },
    onError: (error: any) => toast.error(`Update failed: ${error.message}`),
  });

  const sendTestNotification = async (type: "litter" | "birthday" | "health_tip") => {
    if (!user) return;
    let details = {
      title: "",
      message: "",
      type,
    };
    if (type === "litter") {
      details.title = "New Litter Alerts Enabled";
      details.message = "You'll receive notifications for new litters!";
    } else if (type === "birthday") {
      details.title = "Birthday Reminders Enabled";
      details.message = "You'll receive birthday reminders for your puppies!";
    } else if (type === "health_tip") {
      details.title = "Health & Care Tips Enabled";
      details.message = "You'll receive puppy health tips!";
    }
    
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: details.type,
        title: details.title,
        message: details.message,
      })
    });
    
    if (response.ok) {
      queryClient.invalidateQueries({ queryKey: ["user-notifications", user.id] });
      toast.success(`Test notification sent (${details.title})`);
    }
  };

  const handlePreferenceChange = async (
    key: string,
    checked: boolean
  ) => {
    const currentPreferences =
      subscription?.preferences || {
        litter_notifications: false,
        birthday_reminders: false,
        health_tips: false,
      };
    const newPreferences = { ...currentPreferences, [key]: checked };
    subscriptionMutation.mutate(newPreferences);

    // Send demo notification if toggled ON
    if (checked) {
      if (key === "litter_notifications") await sendTestNotification("litter");
      if (key === "birthday_reminders") await sendTestNotification("birthday");
      if (key === "health_tips") await sendTestNotification("health_tip");
    }
  };

  if (isLoadingProfile || isLoadingSubscription) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">My Profile</h1>
            {user?.isBreeder && (
              <div className="flex items-center gap-2 text-amber-600">
                <Crown className="h-5 w-5" />
                <span className="font-medium">Breeder Account</span>
              </div>
            )}
          </div>
          
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium text-gray-700">Username</Label>
                  <p className="text-sm text-gray-900 mt-1">{user?.username}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium text-gray-700">Account Type</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {user?.isBreeder ? 'Breeder' : 'Customer'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Breeder-specific sections */}
          {user?.isBreeder && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Breeder Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your breeding operations and customer relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button asChild variant="outline">
                    <Link to="/admin">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Admin Panel
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/blog">
                      Manage Blog Posts
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* User sections available to all authenticated users */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle>Your Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/high-table">
                      <Users className="h-4 w-4 mr-2" />
                      Access High Table
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how you receive updates and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="litter-notifications">New Litter Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified when new litters are available</p>
                  </div>
                  <Switch
                    id="litter-notifications"
                    checked={subscription?.preferences?.litter_notifications || false}
                    onCheckedChange={(checked) => handlePreferenceChange("litter_notifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="health-tips">Health & Care Tips</Label>
                    <p className="text-sm text-muted-foreground">Receive puppy health and care advice</p>
                  </div>
                  <Switch
                    id="health-tips"
                    checked={subscription?.preferences?.health_tips || false}
                    onCheckedChange={(checked) => handlePreferenceChange("health_tips", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
