
import { useState } from 'react';
import { LitterForm } from './LitterForm';
import { PuppyForm } from './PuppyForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Litter interface for JWT authentication system
interface Litter {
  id: string;
  breeder_id: string;
  dam_name: string;
  sire_name: string;
  date_of_birth: string | null;
  expected_date: string | null;
  total_puppies: number;
  available_puppies: number;
  male_price: number | null;
  female_price: number | null;
  deposit_amount: number | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface AddLitterManagerProps {
  breederId: string;
  onLitterAdded: () => void;
}

export const AddLitterManager = ({ breederId, onLitterAdded }: AddLitterManagerProps) => {
  const [createdLitter, setCreatedLitter] = useState<Litter | null>(null);

  const handleLitterCreated = (litter: Litter) => {
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
