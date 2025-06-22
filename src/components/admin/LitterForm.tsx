import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LitterDetail, QuantityDiscount } from "@/types";
import { Label } from "../ui/label";
import { Trash, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const litterSchema = z.object({
  name: z.string().min(2, {
    message: "Litter name must be at least 2 characters.",
  }),
  breed: z.string().min(2, {
    message: "Breed must be at least 2 characters.",
  }),
  birth_date: z.string().nonempty({ message: "Birth date is required." }),
  status: z.enum(['active', 'sold_out', 'archived', 'upcoming']),
  price_per_male: z.string().refine((value) => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }, {
    message: "Price must be a valid number and greater than 0.",
  }),
  price_per_female: z.string().refine((value) => {
    const num = Number(value);
    return !isNaN(num) && num > 0;
  }, {
    message: "Price must be a valid number and greater than 0.",
  }),
  total_male_puppies: z.string().refine((value) => {
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  }, {
    message: "Male puppies count must be a valid number and cannot be negative.",
  }),
  total_female_puppies: z.string().refine((value) => {
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  }, {
    message: "Female puppies count must be a valid number and cannot be negative.",
  }),
  dam_name: z.string().min(2, {
    message: "Dam's name must be at least 2 characters.",
  }),
  sire_name: z.string().min(2, {
    message: "Sire's name must be at least 2 characters.",
  }),
  description: z.string().optional(),
});

type LitterData = z.infer<typeof litterSchema>;

interface LitterFormProps {
  litter?: (LitterDetail & { stripe_product_id?: string, stripe_male_price_id?: string, stripe_female_price_id?: string, quantity_discounts?: QuantityDiscount[] }) | null;
  breederId: string;
  onSave: (litter: any) => void;
  onCancel: () => void;
}

export const LitterForm: React.FC<LitterFormProps> = ({ litter, breederId, onSave, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [damImageFile, setDamImageFile] = useState<File | null>(null);
  const [sireImageFile, setSireImageFile] = useState<File | null>(null);
  const [litterImageFile, setLitterImageFile] = useState<File | null>(null);
  const [quantityDiscounts, setQuantityDiscounts] = useState<QuantityDiscount[]>([]);
  
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedLogs, setSeedLogs] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    if (litter?.quantity_discounts) {
      setQuantityDiscounts(litter.quantity_discounts);
    }
  }, [litter]);
  
  const form = useForm<LitterData>({
    resolver: zodResolver(litterSchema),
    defaultValues: {
      name: litter?.name || "",
      breed: litter?.breed || "",
      birth_date: litter?.birth_date || "",
      status: litter?.status || "upcoming", // Default to upcoming for new litters
      price_per_male: litter?.price_per_male ? (litter.price_per_male / 100).toString() : "500",
      price_per_female: litter?.price_per_female ? (litter.price_per_female / 100).toString() : "600",
      total_male_puppies: litter ? Math.floor((litter.total_puppies || 0) / 2).toString() : "2",
      total_female_puppies: litter ? Math.ceil((litter.total_puppies || 0) / 2).toString() : "2",
      dam_name: litter?.dam_name || "",
      sire_name: litter?.sire_name || "",
      description: litter?.description || "",
    },
    mode: "onChange",
  });

  const handleAddDiscount = () => {
    setQuantityDiscounts([...quantityDiscounts, { quantity: 2, discount_percentage: 10 }]);
  };

  const handleDiscountChange = (index: number, field: keyof QuantityDiscount, value: string) => {
    const newDiscounts = [...quantityDiscounts];
    newDiscounts[index] = { ...newDiscounts[index], [field]: Number(value) };
    setQuantityDiscounts(newDiscounts);
  };

  const handleRemoveDiscount = (index: number) => {
    const newDiscounts = quantityDiscounts.filter((_, i) => i !== index);
    setQuantityDiscounts(newDiscounts);
  };

  const handleSeedTestLitters = async () => {
    setIsSeeding(true);
    setSeedLogs([]);
    try {
      const SUPABASE_URL = "https://jkobyxmrzqxhtuqxcudy.supabase.co";
      const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb2J5eG1yenF4aHR1cXhjdWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4OTUwODEsImV4cCI6MjA2NTQ3MTA4MX0.qw0NGAoLmg6kpvAyQKLvySwM6cBPfWKeroN1sP81m6E";

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/seed-stripe-test-litters`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ breederId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to start seed process. The server sent an unexpected response.' }));
        throw new Error(errorData.message || 'Failed to start seed process.');
      }

      if (!response.body) throw new Error("Response body is empty.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
            if (part.startsWith('data: ')) {
                try {
                    const json = JSON.parse(part.substring(6));
                    setSeedLogs(prev => [...prev, json.message]);

                    if (json.type === 'success') {
                        toast({ title: "Success", description: json.message });
                    } else if (json.type === 'error') {
                        toast({ title: "Error", description: json.message, variant: "destructive" });
                    }
                } catch (e) {
                    console.error("Failed to parse stream data:", e, "Data:", part);
                }
            }
        }
      }
    } catch (error: any) {
      toast({ title: "Error Seeding Test Data", description: error.message, variant: "destructive" });
      setSeedLogs(prev => [...prev, `Client-side error: ${error.message}`]);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCleanupTestLitters = async () => {
    setIsCleaning(true);
    try {
      const { error } = await supabase.functions.invoke('cleanup-stripe-test-litters');
      if (error) throw new Error(`Cleanup error: ${error.message}`);
      toast({
        title: "Test Litters Cleaned Up",
        description: "All test litters have been removed from Stripe and your database.",
      });
    } catch (error: any) {
      toast({
        title: "Error Cleaning Up Test Data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  // Function to change status to active/available
  const handleActivateLitter = async () => {
    if (!litter) return;
    
    try {
      const { error } = await supabase
        .from("litters")
        .update({ status: "active" })
        .eq("id", litter.id);
      
      if (error) throw error;
      
      toast({
        title: "Litter Activated",
        description: "Litter status has been changed to active.",
      });
      
      // Refresh the litter data
      const { data: updatedLitter, error: fetchError } = await supabase
        .from("litters")
        .select()
        .eq("id", litter.id)
        .single();
      
      if (!fetchError && updatedLitter) {
        onSave(updatedLitter);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to activate litter: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: LitterData) => {
    setIsSubmitting(true);
    try {
      const totalPuppies = Number(data.total_male_puppies) + Number(data.total_female_puppies);
      
      // Only create Stripe products for active litters
      let stripeIds = {};
      if (data.status === 'active') {
        const stripePayload = {
          name: data.name,
          description: data.description,
          price_per_male: Math.round(Number(data.price_per_male) * 100),
          price_per_female: Math.round(Number(data.price_per_female) * 100),
          stripe_product_id: litter?.stripe_product_id,
          stripe_male_price_id: litter?.stripe_male_price_id,
          stripe_female_price_id: litter?.stripe_female_price_id,
        };

        const { data: stripeResponse, error: stripeError } = await supabase.functions.invoke(
          'create-stripe-litter',
          { body: stripePayload }
        );

        if (stripeError) {
          throw new Error(`Stripe error: ${stripeError.message}`);
        }
        stripeIds = stripeResponse;
      }

      const litterData = {
        name: data.name,
        breed: data.breed,
        birth_date: data.birth_date,
        status: data.status,
        price_per_male: Math.round(Number(data.price_per_male) * 100),
        price_per_female: Math.round(Number(data.price_per_female) * 100),
        total_puppies: totalPuppies,
        dam_name: data.dam_name,
        sire_name: data.sire_name,
        description: data.description,
        breeder_id: breederId,
        available_puppies: data.status === 'upcoming' ? 0 : totalPuppies,
        quantity_discounts: quantityDiscounts as any, // Cast to any to satisfy Supabase Json type
        ...stripeIds,
      };

      let savedLitter;
      if (litter) {
        const { data: updatedLitter, error } = await supabase
          .from("litters")
          .update(litterData)
          .eq("id", litter.id)
          .select()
          .single();
        if (error) throw error;
        savedLitter = updatedLitter;
      } else {
        const { data: newLitter, error } = await supabase
          .from("litters")
          .insert(litterData)
          .select()
          .single();
        if (error) throw error;
        savedLitter = newLitter;
        
        toast({
          title: "Litter Created",
          description: `${data.name} has been created successfully as ${data.status === 'upcoming' ? 'upcoming' : 'active'}.`,
        });
      }

      const uploadImage = async (file: File | null, type: string) => {
        if (!file) return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${savedLitter.id}-${type}-${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('litter-images').upload(fileName, file);

        if (error) {
          console.error(`Error uploading ${type} image:`, error);
          toast({ title: `Error uploading ${type} image`, description: error.message, variant: "destructive" });
          return null;
        }
        
        const { data: { publicUrl } } = supabase.storage.from('litter-images').getPublicUrl(data.path);
        return publicUrl;
      };

      const imageUrlsToUpdate: { dam_image_url?: string; sire_image_url?: string; image_url?: string } = {};
      const dam_image_url = await uploadImage(damImageFile, 'dam');
      if (dam_image_url) imageUrlsToUpdate.dam_image_url = dam_image_url;
      const sire_image_url = await uploadImage(sireImageFile, 'sire');
      if (sire_image_url) imageUrlsToUpdate.sire_image_url = sire_image_url;
      const image_url = await uploadImage(litterImageFile, 'litter');
      if (image_url) imageUrlsToUpdate.image_url = image_url;
      
      if (Object.keys(imageUrlsToUpdate).length > 0) {
        const { data: finalLitter, error: updateError } = await supabase
          .from('litters')
          .update(imageUrlsToUpdate)
          .eq('id', savedLitter.id)
          .select()
          .single();
        if (updateError) throw updateError;
        onSave(finalLitter);
      } else {
        onSave(savedLitter);
      }

    } catch (error: any) {
      toast({
        title: "Error saving litter",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Show activation button for upcoming litters */}
        {litter && litter.status === 'upcoming' && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2">Upcoming Litter</h3>
            <p className="text-sm text-yellow-700 mb-3">
              This litter is marked as upcoming. Click the button below to make it active and available for purchase.
            </p>
            <Button type="button" onClick={handleActivateLitter} className="bg-green-600 hover:bg-green-700">
              Make Available/Active
            </Button>
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Litter Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter litter name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="breed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Breed</FormLabel>
              <FormControl>
                <Input placeholder="Enter breed" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="birth_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Birth Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold_out">Sold Out</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Use "Upcoming" for litters not yet available for purchase, "Active" for available litters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price_per_male"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per Male Puppy ($)</FormLabel>
                <FormControl>
                  <Input placeholder="500" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price_per_female"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per Female Puppy ($)</FormLabel>
                <FormControl>
                  <Input placeholder="600" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="total_male_puppies"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Male Puppies Count</FormLabel>
                <FormControl>
                  <Input placeholder="2" type="number" {...field} />
                </FormControl>
                <FormDescription>
                  You can update this count even after creating the litter
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="total_female_puppies"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Female Puppies Count</FormLabel>
                <FormControl>
                  <Input placeholder="2" type="number" {...field} />
                </FormControl>
                <FormDescription>
                  You can update this count even after creating the litter
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="dam_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dam's Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter dam's name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sire_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sire's Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter sire's name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter litter description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
                <Label className="text-base font-semibold">Quantity Discounts</Label>
                <p className="text-sm text-muted-foreground">
                    Offer a percentage discount for purchasing multiple puppies from this litter.
                </p>
            </div>
            <div className="space-y-2">
                {quantityDiscounts.map((discount, index) => (
                    <div key={index} className="flex items-end gap-2">
                        <div className="grid flex-1 grid-cols-2 gap-2">
                            <div>
                                <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                                <Input 
                                    id={`quantity-${index}`}
                                    type="number" 
                                    min="2"
                                    placeholder="e.g. 2" 
                                    value={discount.quantity}
                                    onChange={(e) => handleDiscountChange(index, 'quantity', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor={`discount-${index}`}>Discount (%)</Label>
                                <Input 
                                    id={`discount-${index}`}
                                    type="number"
                                    min="1"
                                    max="100"
                                    placeholder="e.g. 10" 
                                    value={discount.discount_percentage}
                                    onChange={(e) => handleDiscountChange(index, 'discount_percentage', e.target.value)}
                                />
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" type="button" onClick={() => handleRemoveDiscount(index)} className="mb-1">
                            <Trash className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddDiscount}>
                Add Discount Tier
            </Button>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
                <Label className="text-base font-semibold">Stripe Test Utilities</Label>
                <p className="text-sm text-muted-foreground">
                    Automatically create or delete test litters in Stripe and your database. This may take a minute, so please be patient.
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleSeedTestLitters}
                    disabled={isSeeding || isCleaning || isSubmitting}
                >
                    {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Seed 2 Test Litters
                </Button>
                <Button 
                    type="button" 
                    variant="destructive"
                    onClick={handleCleanupTestLitters}
                    disabled={isSeeding || isCleaning || isSubmitting}
                >
                    {isCleaning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cleanup Test Litters
                </Button>
            </div>
            {isSeeding && seedLogs.length > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-md max-h-60 overflow-y-auto">
                  <p className="font-semibold mb-2">Seeding Logs:</p>
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                      {seedLogs.join('\n')}
                  </pre>
              </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
                <Label htmlFor="litter-image">Litter Image</Label>
                <Input id="litter-image" type="file" onChange={(e) => setLitterImageFile(e.target.files ? e.target.files[0] : null)} />
                {litter?.image_url && <img src={litter.image_url} alt="Litter" className="w-full h-auto rounded-md mt-2" />}
            </div>
            <div className="space-y-2">
                <Label htmlFor="dam-image">Dam's Image</Label>
                <Input id="dam-image" type="file" onChange={(e) => setDamImageFile(e.target.files ? e.target.files[0] : null)} />
                 {litter?.dam_image_url && <img src={litter.dam_image_url} alt="Dam" className="w-full h-auto rounded-md mt-2" />}
            </div>
            <div className="space-y-2">
                <Label htmlFor="sire-image">Sire's Image</Label>
                <Input id="sire-image" type="file" onChange={(e) => setSireImageFile(e.target.files ? e.target.files[0] : null)} />
                 {litter?.sire_image_url && <img src={litter.sire_image_url} alt="Sire" className="w-full h-auto rounded-md mt-2" />}
            </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isSeeding || isCleaning}>
            {isSubmitting ? "Saving..." : "Save Litter"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
