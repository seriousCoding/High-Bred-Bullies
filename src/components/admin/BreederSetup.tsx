import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface BreederSetupProps {
  onBreederCreated: () => void;
}

export const BreederSetup = ({ onBreederCreated }: BreederSetupProps) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    businessName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    deliveryAreas: '',
    deliveryFee: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) throw new Error('No user found');

      const deliveryAreasArray = formData.deliveryAreas
        .split(',')
        .map(area => area.trim())
        .filter(area => area.length > 0);
        
      const deliveryFeeInCents = formData.deliveryFee ? Math.round(parseFloat(formData.deliveryFee) * 100) : 0;

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/breeders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          business_name: formData.businessName,
          contact_phone: formData.contactPhone,
          contact_email: formData.contactEmail,
          address: formData.address,
          delivery_areas: deliveryAreasArray,
          delivery_fee: deliveryFeeInCents,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create breeder profile');
      }

      toast.success('Breeder profile created successfully!');
      onBreederCreated();
    } catch (error: any) {
      console.error('Error creating breeder profile:', error);
      toast.error(error.message || 'Failed to create breeder profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Set Up Your Breeder Profile</CardTitle>
        <CardDescription>
          Complete your breeder profile to start managing litters and orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              type="text"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              required
              placeholder="Your Kennel Name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              type="tel"
              value={formData.contactPhone}
              onChange={(e) => handleInputChange('contactPhone', e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => handleInputChange('contactEmail', e.target.value)}
              placeholder="contact@yourkennel.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Your business address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryFee">Delivery Fee ($)</Label>
            <Input
              id="deliveryFee"
              type="number"
              value={formData.deliveryFee}
              onChange={(e) => handleInputChange('deliveryFee', e.target.value)}
              placeholder="e.g., 50.00"
              step="0.01"
            />
            <p className="text-sm text-muted-foreground">
              Set your delivery fee in dollars. Leave blank or 0 if delivery is free.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryAreas">Delivery ZIP Codes</Label>
            <Input
              id="deliveryAreas"
              type="text"
              value={formData.deliveryAreas}
              onChange={(e) => handleInputChange('deliveryAreas', e.target.value)}
              placeholder="e.g., 90210, 10001, 33109"
            />
            <p className="text-sm text-muted-foreground">
              Enter ZIP codes you deliver to, separated by commas. Leave blank if you don't offer delivery.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Profile...</> : 'Create Breeder Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
