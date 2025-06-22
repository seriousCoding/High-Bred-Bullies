import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserOnboarding } from "@/hooks/useUserOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserProfile, NewsletterSubscription } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import NotificationList from "@/components/NotificationList";
import OrderHistory from "@/components/OrderHistory";
import CreatePostCard from "@/components/CreatePostCard";
import EnhancedProfileForm from "@/components/EnhancedProfileForm";
import HighTableNavCard from "@/components/HighTableNavCard";
import MessagingCenter from "@/components/MessagingCenter";

const ProfilePage = () => {
  const { user } = useAuth();
  const { userProfile, isPetOwner, isOnboarding, isReady } = useUserOnboarding();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;
      const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user && isReady,
  });

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['newsletter-subscription', user?.id],
    queryFn: async (): Promise<Partial<NewsletterSubscription> | null> => {
      if (!user) return null;
      const { data, error } = await supabase.from('newsletter_subscriptions').select('*').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw new Error(error.message);
      return data as any;
    },
    enabled: !!user && isReady,
  });

  const profileMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_profiles").update(values).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated successfully!");
    },
    onError: (error) => toast.error(`Failed to update profile: ${error.message}`),
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (preferences: NewsletterSubscription['preferences']) => {
        if (!user || !user.email) throw new Error("User not authenticated");
        
        const { data: existingSub } = await supabase.from('newsletter_subscriptions').select('id').eq('user_id', user.id).single();

        if (existingSub) {
            const { error } = await supabase.from('newsletter_subscriptions').update({ preferences }).eq('user_id', user.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('newsletter_subscriptions').insert({ user_id: user.id, email: user.email, preferences });
            if (error) throw error;
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['newsletter-subscription', user?.id]});
        toast.success("Notification preferences updated!");
    },
    onError: (error) => toast.error(`Update failed: ${error.message}`),
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
    const { error } = await supabase.from("user_notifications").insert([
      {
        user_id: user.id,
        type: details.type,
        title: details.title,
        message: details.message,
      },
    ]);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["user-notifications", user.id] });
      toast.success(`Test notification sent (${details.title})`);
    }
  };

  const handlePreferenceChange = async (
    key: keyof NonNullable<NewsletterSubscription['preferences']>,
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
