
import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import Footer from '@/components/Footer';
import LitterCard from '@/components/LitterCard';
import { Litter } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

const fetchLitters = async (): Promise<Litter[]> => {
  const response = await fetch(`${API_BASE_URL}/api/litters`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch litters');
  }

  const data = await response.json();
  return (data || []) as Litter[];
};

const LittersPage = () => {
  const queryClient = useQueryClient();
  const { data: litters, isLoading, error } = useQuery({
    queryKey: ['activeLitters'],
    queryFn: fetchLitters,
  });

  useEffect(() => {
    // Real-time updates removed for JWT authentication system
  }, [queryClient]);

  // Separate active and upcoming litters
  const activeLitters = litters?.filter(litter => litter.status === 'active' && litter.available_puppies > 0) || [];
  const upcomingLitters = litters?.filter(litter => litter.status === 'upcoming') || [];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground font-['Playfair_Display']">Find Your Perfect Puppy</h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">Browse our current and upcoming litters from trusted, ethical breeders.</p>
        </div>
        
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Litters</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (
          <>
            {/* Active Litters Section */}
            {activeLitters.length > 0 && (
              <div className="mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-6 font-['Playfair_Display']">Available Now</h2>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {activeLitters.map(litter => (
                    <LitterCard key={litter.id} litter={litter} />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Litters Section */}
            {upcomingLitters.length > 0 && (
              <div className="mb-12">
                <h2 className="text-3xl font-bold text-foreground mb-6 font-['Playfair_Display']">Coming Soon</h2>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingLitters.map(litter => (
                    <LitterCard key={litter.id} litter={litter} />
                  ))}
                </div>
              </div>
            )}

            {/* No Litters Message */}
            {activeLitters.length === 0 && upcomingLitters.length === 0 && (
              <div className="text-center py-20">
                <h2 className="text-2xl font-semibold text-foreground">No Litters Available</h2>
                <p className="mt-2 text-muted-foreground">Please check back soon, our breeders are working hard on new litters!</p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default LittersPage;
