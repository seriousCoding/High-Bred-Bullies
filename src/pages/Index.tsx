import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import LitterCard from '@/components/LitterCard';
import { Litter } from '@/types';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect } from 'react';
import { APP_NAME } from '@/constants/app';

const fetchFeaturedLitters = async (): Promise<Litter[]> => {
  const { data, error } = await supabase
    .from('litters')
    .select(`
      id,
      name,
      breed,
      birth_date,
      available_puppies,
      total_puppies,
      price_per_male,
      price_per_female,
      image_url,
      breeders (
        business_name
      )
    `)
    .eq('status', 'active')
    .gt('available_puppies', 0)
    .order('birth_date', { ascending: false })
    .limit(3);

  if (error) {
    console.error("Error fetching featured litters:", error);
    throw error;
  }
  return (data as any[] || []) as Litter[];
};

const Index = () => {
  const queryClient = useQueryClient();
  const { data: featuredLitters, isLoading, error } = useQuery({
    queryKey: ['featuredLitters'],
    queryFn: fetchFeaturedLitters,
  });

  useEffect(() => {
    const channel = supabase
      .channel('realtime-litters-index')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'litters' },
        (payload) => {
          console.log('Litter update received, invalidating featured litters list.', payload.new.id);
          queryClient.invalidateQueries({ queryKey: ['featuredLitters'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="text-foreground">
          <div className="container mx-auto px-6 h-[90vh] min-h-[700px] flex items-center">
            <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8">
              {/* Left side text */}
              <div className="md:w-1/2 text-center md:text-left">
                <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-4">The Home of Elite Hybrid Bullies.</h1>
                <p className="mt-4 text-lg md:text-xl text-foreground/80 mb-8">Specializing in health-tested, uniquely colored hybrid bullies with exceptional temperaments.</p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <Button asChild size="lg">
                    <Link to="/litters">View Available Puppies</Link>
                  </Button>
                </div>
              </div>

              {/* Right side image */}
              <div className="md:w-1/2 flex justify-center md:justify-end">
                <img src="/lovable-uploads/847088e1-bd9f-49a9-8039-cd5c782b7a6e.png" alt="Merle Hybrid Bully" className="max-w-full md:max-w-md lg:max-w-lg xl:max-w-2xl drop-shadow-2xl" />
              </div>
            </div>
          </div>
        </section>

        {/* About Us Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Our Breeding Philosophy</h2>
            <p className="max-w-3xl mx-auto text-muted-foreground">
              At {APP_NAME}, our philosophy is simple: health, temperament, and structure are paramount. We are dedicated to producing extraordinary merle hybrid bullies that are not only visually stunning but are also robust, well-socialized, and free from common genetic ailments. Our dogs are family, and we raise them to be the perfect addition to yours.
            </p>
          </div>
        </section>

        {/* Featured Litters Section */}
        <section className="py-16 md:py-24 bg-card/50">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold mb-12 text-center">Featured Puppies</h2>
            
            {isLoading && (
              <div className="flex justify-center items-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="max-w-2xl mx-auto">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Fetching Pets</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
              </Alert>
            )}

            {featuredLitters && featuredLitters.length > 0 && (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {featuredLitters.map(litter => (
                  <LitterCard key={litter.id} litter={litter} />
                ))}
              </div>
            )}
            
            {featuredLitters && featuredLitters.length === 0 && !isLoading && (
               <div className="text-center">
                 <p className="text-muted-foreground mb-8">No featured puppies right now. Check back soon!</p>
               </div>
            )}

            <div className="text-center mt-12">
              <Button asChild variant="outline">
                <Link to="/litters">Browse All Litters</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Blog Section Placeholder */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 text-center">
              <h2 className="text-3xl font-bold mb-8">Knowledge Center</h2>
              <p className="text-muted-foreground mb-8">Explore our articles on bully breeds, health & wellness, training tips, and more.</p>
              <Button asChild>
                <Link to="/blog">Explore Articles</Link>
              </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
