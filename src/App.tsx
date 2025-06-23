import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import Index from '@/pages/Index';
import AuthPage from '@/pages/AuthPage';
import ProfilePage from '@/pages/ProfilePage';
import LittersPage from '@/pages/LittersPage';
import LitterDetailPage from '@/pages/LitterDetailPage';
import UpcomingLittersPage from '@/pages/UpcomingLittersPage';
import ContactPage from '@/pages/ContactPage';
import BlogListPage from '@/pages/BlogListPage';
import BlogPostPage from '@/pages/BlogPostPage';
import EditBlogPostPage from '@/pages/EditBlogPostPage';
import AdminPage from '@/pages/AdminPage';
import ManageLitterPage from '@/pages/ManageLitterPage';
import CheckoutSuccessPage from '@/pages/CheckoutSuccessPage';
import CheckoutCancelPage from '@/pages/CheckoutCancelPage';
import { PurchaseSuccessPage } from '@/pages/PurchaseSuccessPage';
import SchedulePickupPage from '@/pages/SchedulePickupPage';
import HighTablePage from '@/pages/HighTablePage';
import EmailVerificationPage from '@/pages/EmailVerificationPage';
import NotFound from '@/pages/NotFound';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import ProtectedRoute from '@/components/ProtectedRoute';
import { usePWA } from '@/hooks/usePWA';

const queryClient = new QueryClient();

function App() {
  const { isInstallable, isInstalled } = usePWA();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (isInstallable && !isInstalled) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 10000); // Show after 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/litters" element={<LittersPage />} />
            <Route path="/litters/:id" element={<LitterDetailPage />} />
            <Route path="/upcoming-litters" element={<UpcomingLittersPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:id" element={<BlogPostPage />} />
            <Route path="/blog/edit/:id" element={
              <ProtectedRoute requireBreeder={true}>
                <EditBlogPostPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireBreeder={true}>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/litters/:id" element={
              <ProtectedRoute requireBreeder={true}>
                <ManageLitterPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/litter/:id" element={
              <ProtectedRoute requireBreeder={true}>
                <ManageLitterPage />
              </ProtectedRoute>
            } />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
            <Route path="/purchase-success" element={<PurchaseSuccessPage />} />
            <Route path="/schedule-pickup/:orderId" element={
              <ProtectedRoute>
                <SchedulePickupPage />
              </ProtectedRoute>
            } />
            <Route path="/high-table" element={
              <ProtectedRoute>
                <HighTablePage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/verify-email" element={<EmailVerificationPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          {showInstallPrompt && !isInstalled && (
            <PWAInstallPrompt onDismiss={() => setShowInstallPrompt(false)} />
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
