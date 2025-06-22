
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BreederSetup } from "@/components/admin/BreederSetup";
import { LittersList } from "@/components/admin/LittersList";
import { AddLitterManager } from "@/components/admin/AddLitterManager";
import { AdminBlogManager } from "@/components/admin/AdminBlogManager";
import { AdminInquiries } from "@/components/admin/AdminInquiries";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminSocialPosts } from "@/components/admin/AdminSocialPosts";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { ArchivedOrders } from "@/components/admin/ArchivedOrders";

const AdminPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [breederId, setBreederId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("litters");

  const { data: breeder, isLoading, error } = useQuery({
    queryKey: ['breederCheck', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('breeders').select('id').eq('user_id', user.id).single();
      if (data?.id) setBreederId(data.id);
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        {!breederId ? (
          <BreederSetup onBreederCreated={() => queryClient.invalidateQueries({ queryKey: ['breederCheck', user?.id] })} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="litters">Litters</TabsTrigger>
              <TabsTrigger value="add-litter">Add New Litter</TabsTrigger>
              <TabsTrigger value="blog">Blog</TabsTrigger>
              <TabsTrigger value="social">Social Posts</TabsTrigger>
              <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="archived-orders">Archived Orders</TabsTrigger>
              <TabsTrigger value="settings">Business Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="litters">
              <LittersList breederId={breederId} />
            </TabsContent>
            <TabsContent value="add-litter">
              <AddLitterManager 
                breederId={breederId} 
                onLitterAdded={() => {
                  queryClient.invalidateQueries({ queryKey: ['litters', breederId] });
                  setActiveTab("litters");
                }} 
              />
            </TabsContent>
            <TabsContent value="blog"><AdminBlogManager /></TabsContent>
            <TabsContent value="social"><AdminSocialPosts /></TabsContent>
            <TabsContent value="inquiries"><AdminInquiries /></TabsContent>
            <TabsContent value="orders"><AdminOrders /></TabsContent>
            <TabsContent value="archived-orders"><ArchivedOrders /></TabsContent>
            <TabsContent value="settings">
                <BusinessSettings 
                    breederId={breederId} 
                    onSettingsUpdated={() => {
                        queryClient.invalidateQueries({ queryKey: ['breederCheck', user?.id] });
                    }}
                />
            </TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminPage;
