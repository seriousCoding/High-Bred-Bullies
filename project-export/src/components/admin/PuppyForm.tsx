
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
import { Trash, Plus } from 'lucide-react';

const puppySchema = z.object({
  name: z.string().optional(),
  gender: z.enum(['male', 'female']),
  color: z.string().min(1, 'Color is required'),
  markings: z.string().optional(),
  weight_at_birth: z.string().optional(),
  notes: z.string().optional(),
  stripe_price_id: z.string().optional(),
});

type PuppyData = z.infer<typeof puppySchema>;

interface Puppy {
  id: string;
  name: string | null;
  gender: 'male' | 'female';
  color: string;
  markings: string | null;
  weight_at_birth: number | null;
  notes: string | null;
  stripe_price_id: string | null;
  image_url: string | null;
  is_available: boolean | null;
  reserved_by: string | null;
  sold_to: string | null;
}

interface PuppyFormProps {
  litterId: string;
  totalPuppies?: number;
  puppyToEdit?: Puppy;
  onComplete: () => void;
  onCancel?: () => void;
}

export const PuppyForm: React.FC<PuppyFormProps> = ({ 
  litterId, 
  totalPuppies, 
  puppyToEdit, 
  onComplete, 
  onCancel 
}) => {
  const [puppies, setPuppies] = useState<PuppyData[]>(() => {
    if (puppyToEdit) {
      return [{
        name: puppyToEdit.name || '',
        gender: puppyToEdit.gender,
        color: puppyToEdit.color,
        markings: puppyToEdit.markings || '',
        weight_at_birth: puppyToEdit.weight_at_birth?.toString() || '',
        notes: puppyToEdit.notes || '',
        stripe_price_id: puppyToEdit.stripe_price_id || '',
      }];
    }
    
    return Array.from({ length: totalPuppies || 1 }, () => ({
      name: '',
      gender: 'male' as const,
      color: '',
      markings: '',
      weight_at_birth: '',
      notes: '',
      stripe_price_id: '',
    }));
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>(new Array(puppies.length).fill(null));

  const form = useForm();

  const updatePuppy = (index: number, field: keyof PuppyData, value: string) => {
    const newPuppies = [...puppies];
    newPuppies[index] = { ...newPuppies[index], [field]: value };
    setPuppies(newPuppies);
  };

  const addPuppy = () => {
    setPuppies([...puppies, { 
      name: '', 
      gender: 'male' as const, 
      color: '',
      markings: '',
      weight_at_birth: '',
      notes: '',
      stripe_price_id: '',
    }]);
    setImageFiles([...imageFiles, null]);
  };

  const removePuppy = (index: number) => {
    if (puppies.length > 1) {
      const newPuppies = puppies.filter((_, i) => i !== index);
      const newImageFiles = imageFiles.filter((_, i) => i !== index);
      setPuppies(newPuppies);
      setImageFiles(newImageFiles);
    }
  };

  const updateImageFile = (index: number, file: File | null) => {
    const newImageFiles = [...imageFiles];
    newImageFiles[index] = file;
    setImageFiles(newImageFiles);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Validate that all puppies have required fields
      const invalidPuppies = puppies.filter(puppy => !puppy.color);
      if (invalidPuppies.length > 0) {
        toast({
          title: "Validation Error",
          description: "All puppies must have a color specified.",
          variant: "destructive",
        });
        return;
      }

      if (puppyToEdit) {
        // Update existing puppy
        const puppy = puppies[0];
        const updateData: any = {
          name: puppy.name || null,
          gender: puppy.gender,
          color: puppy.color,
          markings: puppy.markings || null,
          weight_at_birth: puppy.weight_at_birth ? parseFloat(puppy.weight_at_birth) : null,
          notes: puppy.notes || null,
          stripe_price_id: puppy.stripe_price_id || null,
        };

        // Handle image upload
        const imageFile = imageFiles[0];
        if (imageFile) {
          const formData = new FormData();
          formData.append('image', imageFile);
          
          const token = localStorage.getItem('token');
          const uploadResponse = await fetch(`${API_BASE_URL}/api/puppies/${puppyToEdit.id}/upload-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            toast({
              title: "Error uploading image",
              description: errorData.message || 'Failed to upload image',
              variant: "destructive",
            });
          } else {
            const uploadData = await uploadResponse.json();
            updateData.image_url = uploadData.imageUrl;
          }
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/puppies/${puppyToEdit.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          throw new Error(`Failed to update puppy: ${response.statusText}`);
        }

        toast({
          title: "Success",
          description: "Puppy has been updated.",
        });
      } else {
        // Insert new puppies
        const token = localStorage.getItem('token');
        const puppyData = await Promise.all(puppies.map(async (puppy, index) => {
          let image_url = null;
          
          // Handle image upload
          const imageFile = imageFiles[index];
          if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            const uploadResponse = await fetch(`${API_BASE_URL}/api/upload/puppy-image`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              body: formData,
            });

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              toast({
                title: "Error uploading image",
                description: errorData.message || 'Failed to upload image',
                variant: "destructive",
              });
            } else {
              const uploadData = await uploadResponse.json();
              image_url = uploadData.imageUrl;
            }
          }

          return {
            litter_id: litterId,
            name: puppy.name || null,
            gender: puppy.gender,
            color: puppy.color,
            markings: puppy.markings || null,
            weight_at_birth: puppy.weight_at_birth ? parseFloat(puppy.weight_at_birth) : null,
            notes: puppy.notes || null,
            stripe_price_id: puppy.stripe_price_id || null,
            image_url,
            is_available: true,
          };
        }));

        const response = await fetch(`${API_BASE_URL}/api/puppies`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ puppies: puppyData }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create puppies: ${response.statusText}`);
        }

        toast({
          title: "Success",
          description: `${puppies.length} puppies have been added to the litter.`,
        });
      }

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error saving puppies",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{puppyToEdit ? 'Edit Puppy Details' : 'Add Puppy Details'}</CardTitle>
        <CardDescription>
          {puppyToEdit 
            ? 'Update the details for this puppy.'
            : 'Enter the details for each puppy in this litter. You can adjust the number of puppies using the + and - buttons.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!puppyToEdit && (
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Puppies ({puppies.length})</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addPuppy}>
                <Plus className="h-4 w-4 mr-1" />
                Add Puppy
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {puppies.map((puppy, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name (Optional)</label>
                <Input
                  placeholder="Puppy name"
                  value={puppy.name}
                  onChange={(e) => updatePuppy(index, 'name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gender</label>
                <Select 
                  value={puppy.gender} 
                  onValueChange={(value: 'male' | 'female') => updatePuppy(index, 'gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <Input
                  placeholder="e.g. Black, Brown, White"
                  value={puppy.color}
                  onChange={(e) => updatePuppy(index, 'color', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Markings</label>
                <Input
                  placeholder="e.g. White chest, Black spots"
                  value={puppy.markings}
                  onChange={(e) => updatePuppy(index, 'markings', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Weight (lbs)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  value={puppy.weight_at_birth}
                  onChange={(e) => updatePuppy(index, 'weight_at_birth', e.target.value)}
                />
              </div>
              {!puppyToEdit && (
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePuppy(index)}
                    disabled={puppies.length <= 1}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="md:col-span-6 space-y-2">
                <label className="text-sm font-medium">Stripe Price ID (Optional)</label>
                <Input
                  placeholder="price_... (leave empty to use litter pricing)"
                  value={puppy.stripe_price_id}
                  onChange={(e) => updatePuppy(index, 'stripe_price_id', e.target.value)}
                />
              </div>
              <div className="md:col-span-6 space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  placeholder="Any additional notes about this puppy"
                  value={puppy.notes}
                  onChange={(e) => updatePuppy(index, 'notes', e.target.value)}
                />
              </div>
              <div className="md:col-span-6 space-y-2">
                <label className="text-sm font-medium">Puppy Image</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => updateImageFile(index, e.target.files ? e.target.files[0] : null)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : puppyToEdit ? "Update Puppy" : "Save Puppies"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
