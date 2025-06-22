
import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const settingsSchema = z.object({
  contact_location: z.string().min(1, "Location is required."),
  contact_phone: z.string().min(1, "Phone number is required."),
  contact_email: z.string().email("Invalid email address."),
  business_hours_line1: z.string().min(1, "Business hours line 1 is required."),
  business_hours_line2: z.string().min(1, "Business hours line 2 is required."),
  business_hours_line3: z.string().min(1, "Business hours line 3 is required."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const fetchSettings = async () => {
  const { data, error } = await supabase.from('site_config').select('key, value');
  if (error) throw new Error(error.message);

  const settings = data.reduce((acc, { key, value }) => {
    if (key) {
      acc[key] = value || '';
    }
    return acc;
  }, {} as Record<string, string>);
  
  return settings as SettingsFormValues;
};

const updateSettings = async (values: SettingsFormValues) => {
  const updates = Object.entries(values).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from('site_config').upsert(updates);
  if (error) throw new Error(error.message);
};

export const SiteSettings = () => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['site_settings'],
    queryFn: fetchSettings,
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
        contact_location: '',
        contact_phone: '',
        contact_email: '',
        business_hours_line1: '',
        business_hours_line2: '',
        business_hours_line3: '',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      toast.success('Settings updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['site_settings'] });
      queryClient.invalidateQueries({ queryKey: ['contactInfo'] });
    },
    onError: (error) => {
      toast.error('Failed to update settings:', { description: error.message });
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    mutation.mutate(data);
  };
  
  if (isLoading) {
      return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
      return <div className="text-red-500">Error loading settings: {error.message}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>Manage your website's contact information and business hours.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="contact_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="business_hours_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Hours (Line 1)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="business_hours_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Hours (Line 2)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="business_hours_line3"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Hours (Line 3)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
