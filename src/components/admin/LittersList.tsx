import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { CalendarDays, DollarSign, Users, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Litter {
  id: string;
  name: string;
  breed: string;
  dam_name: string;
  sire_name: string;
  birth_date: string;
  total_puppies: number;
  available_puppies: number;
  price_per_male: number;
  price_per_female: number;
  status: 'active' | 'upcoming' | 'sold_out' | 'archived';
  created_at: string;
}

interface LittersListProps {
  breederId?: string;
}

export const LittersList = ({ breederId }: LittersListProps) => {
  const [litters, setLitters] = useState<Litter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (breederId) {
      fetchLitters();
    } else {
      // If no breederId provided, try to get it from current user
      getCurrentBreederAndFetchLitters();
    }
  }, [breederId]);

  const getCurrentBreederAndFetchLitters = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('No authenticated user found');
        setLoading(false);
        return;
      }

      console.log('Current user:', user.id);

      const { data: breederData, error: breederError } = await supabase
        .from('breeders')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (breederError) {
        console.error('Breeder fetch error:', breederError);
        setError('No breeder profile found for current user');
        setLoading(false);
        return;
      }

      console.log('Found breeder:', breederData);
      await fetchLittersForBreeder(breederData.id);
    } catch (error: any) {
      console.error('Error in getCurrentBreederAndFetchLitters:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const fetchLitters = async () => {
    if (!breederId) return;
    await fetchLittersForBreeder(breederId);
  };

  const fetchLittersForBreeder = async (currentBreederId: string) => {
    try {
      console.log('Fetching litters for breeder:', currentBreederId);

      const { data, error } = await supabase
        .from('litters')
        .select('*')
        .eq('breeder_id', currentBreederId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Litters fetch error:', error);
        throw error;
      }

      console.log('Fetched litters:', data);

      // Type cast the status field to ensure it matches our interface
      const typedLitters = (data || []).map(litter => ({
        ...litter,
        status: litter.status as 'active' | 'upcoming' | 'sold_out' | 'archived'
      }));

      setLitters(typedLitters);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching litters:', error);
      setError(`Failed to fetch litters: ${error.message}`);
      toast({
        title: 'Error',
        description: 'Failed to fetch litters',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sold_out':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const handleActivateLitter = async (litterId: string) => {
    try {
      const { error } = await supabase
        .from('litters')
        .update({ status: 'active' })
        .eq('id', litterId);
      
      if (error) throw error;
      
      toast({
        title: 'Litter Activated',
        description: 'Litter status has been changed to active.',
      });
      
      // Refresh the litters list
      if (breederId) {
        fetchLitters();
      } else {
        getCurrentBreederAndFetchLitters();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to activate litter: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLitter = async (litterId: string) => {
    try {
      const { error } = await supabase.functions.invoke('delete-litter', {
        body: { litterId }
      });

      if (error) throw error;

      toast({
        title: 'Litter Deleted',
        description: 'Litter has been permanently deleted.',
      });

      // Refresh the litters list
      if (breederId) {
        fetchLitters();
      } else {
        getCurrentBreederAndFetchLitters();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to delete litter: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Error: {error}</p>
        <Button 
          onClick={() => breederId ? fetchLitters() : getCurrentBreederAndFetchLitters()} 
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (litters.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No litters found</p>
        <p className="text-sm text-muted-foreground">Create your first litter using the "Add New Litter" tab</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {litters.map((litter) => (
        <Card key={litter.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{litter.name}</CardTitle>
                <CardDescription>
                  {litter.breed} • {litter.dam_name} x {litter.sire_name}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getStatusColor(litter.status)} border`}>
                  {litter.status.replace('_', ' ').toUpperCase()}
                </Badge>
                {litter.status === 'upcoming' && (
                  <Button
                    size="sm"
                    onClick={() => handleActivateLitter(litter.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Make Active
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Litter</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{litter.name}"? This action cannot be undone and will also delete all puppies in this litter.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteLitter(litter.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Birth Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(litter.birth_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Puppies</p>
                  <p className="text-sm text-muted-foreground">
                    {litter.status === 'upcoming' 
                      ? `${litter.total_puppies} expected`
                      : `${litter.available_puppies} of ${litter.total_puppies} available`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Price</p>
                  <p className="text-sm text-muted-foreground">
                    M: {formatPrice(litter.price_per_male)} / F: {formatPrice(litter.price_per_female)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/admin/litter/${litter.id}`}>
                    {litter.status === 'upcoming' ? 'View Details' : 'Manage Puppies'}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
