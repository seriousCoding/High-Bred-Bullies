import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2, MessageSquare, User, Crown } from "lucide-react";
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

  if (isOnboarding || isLoadingProfile || isLoadingSubscription) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isOnboarding ? 'Setting up your profile...' : 'Loading profile...'}
          </p>
        </div>
      </div>
    );
  }

  // Use userProfile from onboarding hook or fallback to profile query
  const currentProfile = userProfile || profile;

  console.log('ProfilePage Debug:', {
    user: !!user,
    currentProfile: !!currentProfile,
    isPetOwner,
    isReady,
    userProfileId: currentProfile?.id
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <NotificationList />
          
          <h1 className="text-3xl font-bold">My Profile</h1>
          
          {/* High Table Navigation */}
          <HighTableNavCard isPetOwner={isPetOwner || false} />
          
          {/* Registration Email Display */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-medium text-gray-700">Registration Email</Label>
                <p className="text-sm text-gray-900 mt-1">{user?.email}</p>
                <p className="text-xs text-gray-500 mt-1">Registered on {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Create Post Section - Available to all users with profiles */}
          {currentProfile && isReady && (
            <CreatePostCard 
              userProfileId={currentProfile.id} 
              onPostCreated={() => {
                // Optionally refresh any post-related queries
              }}
            />
          )}

          {/* Messaging Section - Show for all authenticated users with profiles */}
          {user && currentProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Messages & Friends
                  {isPetOwner && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">High Table Member</span>}
                </CardTitle>
                <CardDescription>
                  {isPetOwner 
                    ? "Connect with other pet owners in the High Table community"
                    : "Messaging available to all users - connect with friends and other pet enthusiasts"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link to="/high-table" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Open Full Messaging
                    </Link>
                  </Button>
                </div>
                <div className="border-t pt-8">
                  <div className="max-h-[600px] overflow-hidden">
                    <MessagingCenter />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Order History Section */}
          <OrderHistory />
          
          {/* Enhanced Profile Form */}
          <EnhancedProfileForm 
            profile={currentProfile}
            onSubmit={(data) => profileMutation.mutate(data)}
            isLoading={profileMutation.isPending}
          />
          
          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage your email notification preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="litter_notifications">New Litter Notifications</Label>
                <Switch
                  id="litter_notifications"
                  checked={subscription?.preferences?.litter_notifications || false}
                  onCheckedChange={(checked) => handlePreferenceChange('litter_notifications', checked)}
                  disabled={subscriptionMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="birthday_reminders">Puppy Birthday Reminders</Label>
                <Switch
                  id="birthday_reminders"
                  checked={subscription?.preferences?.birthday_reminders || false}
                  onCheckedChange={(checked) => handlePreferenceChange('birthday_reminders', checked)}
                  disabled={subscriptionMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="health_tips">Health & Care Tips</Label>
                <Switch
                  id="health_tips"
                  checked={subscription?.preferences?.health_tips || false}
                  onCheckedChange={(checked) => handlePreferenceChange('health_tips', checked)}
                  disabled={subscriptionMutation.isPending}
                />
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
