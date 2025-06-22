
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface BreederProfileSettingsProps {
  breederId: string | null;
  onProfileUpdated: () => void;
}

export const BreederProfileSettings = ({ breederId, onProfileUpdated }: BreederProfileSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    deliveryAreas: '',
    deliveryFee: '',
  });

  const { data: breeder, isLoading: isLoadingBreeder } = useQuery({
    queryKey: ['breederProfile', breederId],
    queryFn: async () => {
      if (!breederId) return null;
      const { data, error } = await supabase
        .from('breeders')
        .select('*')
        .eq('id', breederId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!breederId,
  });

  useEffect(() => {
    if (breeder) {
      setFormData({
        businessName: breeder.business_name || '',
        contactPhone: breeder.contact_phone || '',
        contactEmail: breeder.contact_email || '',
        address: breeder.address || '',
        deliveryAreas: (breeder.delivery_areas || []).join(', '),
        deliveryFee: breeder.delivery_fee ? (breeder.delivery_fee / 100).toFixed(2) : '',
      });
    }
  }, [breeder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breederId) return;
    setLoading(true);

    try {
      if (!user) throw new Error('No user found');

      const deliveryAreasArray = formData.deliveryAreas
        .split(',')
        .map(area => area.trim())
        .filter(area => area.length > 0);
      
      const deliveryFeeInCents = formData.deliveryFee ? Math.round(parseFloat(formData.deliveryFee) * 100) : 0;

      const { error } = await supabase.from('breeders').update({
        business_name: formData.businessName,
        contact_phone: formData.contactPhone,
        contact_email: formData.contactEmail,
        address: formData.address,
        delivery_areas: deliveryAreasArray,
        delivery_fee: deliveryFeeInCents,
      }).eq('id', breederId);

      if (error) throw error;

      toast.success('Breeder profile updated successfully!');
      onProfileUpdated();
      queryClient.invalidateQueries({ queryKey: ['breederProfile', breederId] });
    } catch (error: any) {
      console.error('Error updating breeder profile:', error);
      toast.error(error.message || 'Failed to update breeder profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoadingBreeder) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breeder Profile Settings</CardTitle>
        <CardDescription>
          Update your business information and delivery settings here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input id="businessName" type="text" value={formData.businessName} onChange={(e) => handleInputChange('businessName', e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={(e) => handleInputChange('contactPhone', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(e) => handleInputChange('contactEmail', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} rows={3} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="deliveryFee">Delivery Fee ($)</Label>
            <Input id="deliveryFee" type="number" value={formData.deliveryFee} onChange={(e) => handleInputChange('deliveryFee', e.target.value)} placeholder="e.g., 50.00" step="0.01" />
            <p className="text-sm text-muted-foreground">Set your delivery fee in dollars. Leave blank or 0 if delivery is free.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryAreas">Delivery ZIP Codes</Label>
            <Input id="deliveryAreas" type="text" value={formData.deliveryAreas} onChange={(e) => handleInputChange('deliveryAreas', e.target.value)} placeholder="e.g., 90210, 10001, 33109" />
            <p className="text-sm text-muted-foreground">Enter ZIP codes you deliver to, separated by commas. Leave blank if you don't offer delivery.</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Updating...</> : 'Update Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
