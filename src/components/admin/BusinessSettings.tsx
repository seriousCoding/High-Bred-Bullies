
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface BusinessSettingsProps {
  breederId: string | null;
  onSettingsUpdated: () => void;
}

interface SiteConfig {
  contact_location?: string;
  contact_phone?: string;
  contact_email?: string;
  business_hours_line1?: string;
  business_hours_line2?: string;
  business_hours_line3?: string;
}

export const BusinessSettings = ({ breederId, onSettingsUpdated }: BusinessSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Breeder/Business Info
    businessName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    deliveryAreas: '',
    deliveryFee: '',
    
    // Site Contact Info
    contactLocation: '',
    businessHoursLine1: '',
    businessHoursLine2: '',
    businessHoursLine3: '',
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

  const { data: siteConfig, isLoading: isLoadingSiteConfig } = useQuery({
    queryKey: ['siteConfig'],
    queryFn: async (): Promise<SiteConfig> => {
      const { data, error } = await supabase
        .from('site_config')
        .select('*');
      if (error) throw error;
      return data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {} as SiteConfig);
    },
  });

  useEffect(() => {
    if (breeder && siteConfig) {
      setFormData({
        businessName: breeder.business_name || '',
        contactPhone: breeder.contact_phone || '',
        contactEmail: breeder.contact_email || '',
        address: breeder.address || '',
        deliveryAreas: (breeder.delivery_areas || []).join(', '),
        deliveryFee: breeder.delivery_fee ? (breeder.delivery_fee / 100).toFixed(2) : '',
        contactLocation: siteConfig.contact_location || '',
        businessHoursLine1: siteConfig.business_hours_line1 || '',
        businessHoursLine2: siteConfig.business_hours_line2 || '',
        businessHoursLine3: siteConfig.business_hours_line3 || '',
      });
    }
  }, [breeder, siteConfig]);

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

      // Update breeder profile
      const { error: breederError } = await supabase.from('breeders').update({
        business_name: formData.businessName,
        contact_phone: formData.contactPhone,
        contact_email: formData.contactEmail,
        address: formData.address,
        delivery_areas: deliveryAreasArray,
        delivery_fee: deliveryFeeInCents,
      }).eq('id', breederId);

      if (breederError) throw breederError;

      // Update site config
      const siteConfigUpdates = [
        { key: 'contact_location', value: formData.contactLocation },
        { key: 'contact_phone', value: formData.contactPhone },
        { key: 'contact_email', value: formData.contactEmail },
        { key: 'business_hours_line1', value: formData.businessHoursLine1 },
        { key: 'business_hours_line2', value: formData.businessHoursLine2 },
        { key: 'business_hours_line3', value: formData.businessHoursLine3 },
      ];

      for (const update of siteConfigUpdates) {
        const { error: configError } = await supabase
          .from('site_config')
          .upsert(update, { onConflict: 'key' });
        
        if (configError) throw configError;
      }

      toast.success('Business settings updated successfully!');
      onSettingsUpdated();
      queryClient.invalidateQueries({ queryKey: ['breederProfile', breederId] });
      queryClient.invalidateQueries({ queryKey: ['siteConfig'] });
    } catch (error: any) {
      console.error('Error updating business settings:', error);
      toast.error(error.message || 'Failed to update business settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoadingBreeder || isLoadingSiteConfig) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Settings</CardTitle>
        <CardDescription>
          Manage your business information, contact details, and site settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Information Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Business Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input 
                  id="businessName" 
                  type="text" 
                  value={formData.businessName} 
                  onChange={(e) => handleInputChange('businessName', e.target.value)} 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input 
                    id="contactPhone" 
                    type="tel" 
                    value={formData.contactPhone} 
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input 
                    id="contactEmail" 
                    type="email" 
                    value={formData.contactEmail} 
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Textarea 
                  id="address" 
                  value={formData.address} 
                  onChange={(e) => handleInputChange('address', e.target.value)} 
                  rows={3} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactLocation">Public Contact Location</Label>
                <Input 
                  id="contactLocation" 
                  value={formData.contactLocation} 
                  onChange={(e) => handleInputChange('contactLocation', e.target.value)} 
                  placeholder="e.g., 123 Puppy Lane, Dogtown, USA 12345"
                />
                <p className="text-sm text-muted-foreground">This address will be shown on your contact page.</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery Settings Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Delivery Settings</h3>
            <div className="space-y-4">
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
                <p className="text-sm text-muted-foreground">Set your delivery fee in dollars. Leave blank or 0 if delivery is free.</p>
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
                <p className="text-sm text-muted-foreground">Enter ZIP codes you deliver to, separated by commas. Leave blank if you don't offer delivery.</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Business Hours Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Business Hours</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessHoursLine1">Business Hours (Line 1)</Label>
                <Input 
                  id="businessHoursLine1" 
                  value={formData.businessHoursLine1} 
                  onChange={(e) => handleInputChange('businessHoursLine1', e.target.value)} 
                  placeholder="e.g., Monday - Friday: 9:00 AM - 6:00 PM"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessHoursLine2">Business Hours (Line 2)</Label>
                <Input 
                  id="businessHoursLine2" 
                  value={formData.businessHoursLine2} 
                  onChange={(e) => handleInputChange('businessHoursLine2', e.target.value)} 
                  placeholder="e.g., Saturday: 10:00 AM - 4:00 PM"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessHoursLine3">Business Hours (Line 3)</Label>
                <Input 
                  id="businessHoursLine3" 
                  value={formData.businessHoursLine3} 
                  onChange={(e) => handleInputChange('businessHoursLine3', e.target.value)} 
                  placeholder="e.g., Sunday: Closed"
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Updating...</> : 'Update Business Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
