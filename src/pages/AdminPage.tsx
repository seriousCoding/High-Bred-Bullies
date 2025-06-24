
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
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
import EmailManager from "@/components/admin/EmailManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { ArchivedOrders } from "@/components/admin/ArchivedOrders";

const AdminPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("litters");

  // Check if user is a breeder based on the isBreeder flag from JWT auth
  const isBreeder = user?.isBreeder || false;
  
  // Get the actual breeder ID from the database using user ID
  const breederId = isBreeder ? user.id?.toString() : null;

  if (!user) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  
  if (!isBreeder) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You need breeder privileges to access this page.</AlertDescription>
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
          <BreederSetup onBreederCreated={() => window.location.reload()} />
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
              <TabsTrigger value="email">Email Manager</TabsTrigger>
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
            <TabsContent value="blog">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Blog Management</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const response = await fetch('/api/cleanup-stripe-test-litters', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                          });
                          
                          const result = await response.json();
                          
                          if (response.ok) {
                            alert(`Success: ${result.message}`);
                            queryClient.invalidateQueries({ queryKey: ['litters'] });
                            // Force page refresh to ensure UI updates
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          } else {
                            alert(`Error: ${result.message || 'Failed to cleanup test litters'}`);
                          }
                        } catch (error) {
                          alert('Network error occurred');
                          console.error('Cleanup error:', error);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Cleanup Test Litters
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const response = await fetch('/api/seed-stripe-test-litters', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                          });
                          
                          const result = await response.json();
                          
                          if (response.ok) {
                            alert(`Success: ${result.message}`);
                            queryClient.invalidateQueries({ queryKey: ['litters'] });
                            // Force page refresh to ensure UI updates
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          } else {
                            alert(`Error: ${result.message || 'Failed to seed test litters'}`);
                          }
                        } catch (error) {
                          alert('Network error occurred');
                          console.error('Seed error:', error);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Seed Test Litters
                    </button>
                  </div>
                </div>
                <AdminBlogManager />
              </div>
            </TabsContent>
            <TabsContent value="social"><AdminSocialPosts /></TabsContent>
            <TabsContent value="inquiries"><AdminInquiries /></TabsContent>
            <TabsContent value="orders"><AdminOrders /></TabsContent>
            <TabsContent value="archived-orders"><ArchivedOrders /></TabsContent>
            <TabsContent value="email"><EmailManager /></TabsContent>
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
