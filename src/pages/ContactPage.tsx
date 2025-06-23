
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  subject: z.string().min(1, { message: "Subject is required." }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

const fetchContactInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/site-config`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contact info: ${response.statusText}`);
      }

      const data = await response.json();
      
      // The server returns data as an object with key-value pairs directly
      // No need to transform it since it's already in the correct format
      return data;
    } catch (error) {
      console.error('Error fetching contact info:', error);
      return {};
    }
};

const ContactPage = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const { data: contactInfo, isLoading } = useQuery({
      queryKey: ['contactInfo'],
      queryFn: fetchContactInfo
  });

  const submitInquiry = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          subject: values.subject,
          message: values.message
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit inquiry: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Message sent!", {
        description: "Thank you for contacting us. We will get back to you shortly.",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast.error("Failed to send message", {
        description: error.message,
      });
    }
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("New contact form submission:", values);
    submitInquiry.mutate(values);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground font-['Playfair_Display']">Get in Touch</h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">We'd love to hear from you! Send us a message and we'll respond as soon as possible.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-16 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-['Playfair_Display']">Send a Message</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="Question about a litter" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Message</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Tell us more..." className="min-h-[120px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={submitInquiry.isPending}>
                    {submitInquiry.isPending ? 'Sending...' : 'Send Message'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-['Playfair_Display']">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-muted-foreground">
                        <div className="flex items-start">
                            <MapPin className="h-6 w-6 mr-4 text-primary mt-1 shrink-0" />
                            <div>
                                <h3 className="font-semibold text-foreground">Our Location</h3>
                                {isLoading ? <Skeleton className="h-5 w-48 mt-1" /> : <p>{contactInfo?.contact_location}</p>}
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Phone className="h-6 w-6 mr-4 text-primary mt-1 shrink-0" />
                            <div>
                                <h3 className="font-semibold text-foreground">Phone Number</h3>
                                {isLoading ? <Skeleton className="h-5 w-32 mt-1" /> : <p>{contactInfo?.contact_phone}</p>}
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Mail className="h-6 w-6 mr-4 text-primary mt-1 shrink-0" />
                            <div>
                                <h3 className="font-semibold text-foreground">Email Address</h3>
                                {isLoading ? <Skeleton className="h-5 w-40 mt-1" /> : <p>{contactInfo?.contact_email}</p>}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-['Playfair_Display']">Business Hours</CardTitle>
                </CardHeader>
                <CardContent>
                   {isLoading ? (
                       <div className="space-y-2">
                           <Skeleton className="h-5 w-full" />
                           <Skeleton className="h-5 w-full" />
                           <Skeleton className="h-5 w-2/3" />
                       </div>
                   ) : (
                       <p className="text-muted-foreground leading-relaxed">
                          {contactInfo?.business_hours_line1} <br />
                          {contactInfo?.business_hours_line2} <br />
                          {contactInfo?.business_hours_line3}
                       </p>
                   )}
                </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
