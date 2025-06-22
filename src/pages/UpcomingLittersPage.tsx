
import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import Footer from '@/components/Footer';
import LitterCard from '@/components/LitterCard';
import { Litter } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';

const fetchUpcomingLitters = async (): Promise<Litter[]> => {
  console.log('Fetching upcoming litters...');
  
  const response = await fetch(`${API_BASE_URL}/api/litters/upcoming`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch upcoming litters');
  }

  const data = await response.json();
  console.log('Upcoming litters query result:', data);
  
  const processedData = (data || []) as Litter[];
  console.log('Processed upcoming litters:', processedData);
  
  return processedData;
};

const UpcomingLittersPage = () => {
  const queryClient = useQueryClient();
  const { data: upcomingLitters, isLoading, error } = useQuery({
    queryKey: ['upcomingLitters'],
    queryFn: fetchUpcomingLitters,
  });

  console.log('UpcomingLittersPage state:', {
    upcomingLitters,
    isLoading,
    error
  });

  useEffect(() => {
    // Real-time updates removed for JWT authentication system
  }, [queryClient]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Clock className="h-12 w-12 text-blue-500 mr-4" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground font-['Playfair_Display']">Upcoming Litters</h1>
          </div>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Discover our exciting upcoming litters from trusted, ethical breeders. Reserve your spot for future arrivals!
          </p>
        </div>
        
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Upcoming Litters</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (
          <>
            {upcomingLitters && upcomingLitters.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {upcomingLitters.map(litter => (
                  <LitterCard key={litter.id} litter={litter} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-foreground">No Upcoming Litters</h2>
                <p className="mt-2 text-muted-foreground">
                  We don't have any upcoming litters at the moment. Check back soon for new announcements!
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default UpcomingLittersPage;
