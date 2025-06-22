
import { useState } from 'react';
import { LitterForm } from './LitterForm';
import { PuppyForm } from './PuppyForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tables } from '@/integrations/supabase/types';

interface AddLitterManagerProps {
  breederId: string;
  onLitterAdded: () => void;
}

export const AddLitterManager = ({ breederId, onLitterAdded }: AddLitterManagerProps) => {
  const [createdLitter, setCreatedLitter] = useState<Tables<'litters'> | null>(null);

  const handleLitterCreated = (litter: Tables<'litters'>) => {
    // For upcoming litters, skip the puppy form since puppies aren't born yet
    if (litter.status === 'upcoming') {
      onLitterAdded();
      return;
    }
    
    setCreatedLitter(litter);
  };
  
  const handlePuppyFormComplete = () => {
    setCreatedLitter(null);
    onLitterAdded();
  }

  if (createdLitter) {
    if (createdLitter.total_puppies > 0) {
      return (
        <PuppyForm 
          litterId={createdLitter.id} 
          totalPuppies={createdLitter.total_puppies}
          onComplete={handlePuppyFormComplete}
        />
      );
    }
    // If there are no puppies to add, just complete the process.
    handlePuppyFormComplete();
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Litter</CardTitle>
        <CardDescription>
          Start by providing the details for the new litter. For upcoming litters, you can add puppy details later when they're born using the "Manage Litters" section.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LitterForm 
          breederId={breederId} 
          onSave={handleLitterCreated} 
          onCancel={onLitterAdded}
        />
      </CardContent>
    </Card>
  );
};
