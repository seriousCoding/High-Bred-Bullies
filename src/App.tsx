import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import Index from '@/pages/Index';
import AuthPage from '@/pages/AuthPage';
import TradingDashboard from '@/pages/TradingDashboard';
import MarketData from '@/pages/MarketData';
import Portfolio from '@/pages/Portfolio';
import Orders from '@/pages/Orders';
import Settings from '@/pages/Settings';
import ConnectCoinbase from '@/pages/ConnectCoinbase';
import NotFound from '@/pages/NotFound';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
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
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/litters" element={<LittersPage />} />
            <Route path="/litters/:id" element={<LitterDetailPage />} />
            <Route path="/upcoming-litters" element={<UpcomingLittersPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/blog/edit/:id" element={<EditBlogPostPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/litters/:id" element={<ManageLitterPage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
            <Route path="/schedule-pickup/:orderId" element={<SchedulePickupPage />} />
            <Route path="/high-table" element={<HighTablePage />} />
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
