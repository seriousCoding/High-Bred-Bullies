
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Loader2, ArrowLeft, Trash2, Edit } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { PuppyForm } from '@/components/admin/PuppyForm';
import { LitterForm } from '@/components/admin/LitterForm';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Define extended interfaces to match database schema
interface ExtendedPuppy {
  id: string;
  litter_id: string;
  name?: string;
  gender: 'male' | 'female';
  color: string;
  is_available: boolean;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  markings?: string;
  weight_at_birth?: number;
  notes?: string;
  stripe_price_id?: string;
  reserved_by?: string;
  sold_to?: string;
}

interface LitterWithPuppies {
  id: string;
  name: string;
  breed: string;
  birth_date: string;
  available_puppies: number;
  total_puppies: number;
  price_per_male: number;
  price_per_female: number;
  stripe_male_price_id: string | null;
  stripe_female_price_id: string | null;
  stripe_product_id: string | null;
  status: string;
  breeder_id: string | null;
  dam_name: string;
  sire_name: string;
  dam_image_url: string | null;
  sire_image_url: string | null;
  description: string | null;
  image_url: string | null;
  puppies: ExtendedPuppy[];
  quantity_discounts?: any; // Keep as any to avoid Json type issues
}

const ManageLitterPage = () => {
    const { id: litterId } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const [showPuppyForm, setShowPuppyForm] = useState(false);
    const [editingPuppy, setEditingPuppy] = useState<ExtendedPuppy | null>(null);
    const [editingLitter, setEditingLitter] = useState(false);
    const [malePriceId, setMalePriceId] = useState('');
    const [femalePriceId, setFemalePriceId] = useState('');
    const [activeTab, setActiveTab] = useState("puppies");

    const fetchLitterWithPuppies = async (): Promise<LitterWithPuppies> => {
        if (!litterId) throw new Error('No litter ID provided');

        const { data, error } = await supabase
            .from('litters')
            .select('*, puppies(*)')
            .eq('id', litterId)
            .single();
        
        if (error) throw new Error(error.message);
        if (!data) throw new Error('Litter not found');
        
        // Cast the response to our expected type
        return data as LitterWithPuppies;
    };

    const { data: litter, isLoading, error } = useQuery({
        queryKey: ['litterWithPuppies', litterId],
        queryFn: fetchLitterWithPuppies,
        enabled: !!litterId,
    });

    const updateLitterMutation = useMutation({
        mutationFn: async (updatedData: { stripe_male_price_id: string; stripe_female_price_id: string; }) => {
            const { error } = await supabase
                .from('litters')
                .update(updatedData)
                .eq('id', litterId!);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Litter updated successfully." });
            queryClient.invalidateQueries({ queryKey: ['litterWithPuppies', litterId] });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: `Failed to update litter: ${error.message}`, variant: 'destructive' });
        }
    });

    useEffect(() => {
        if (litter) {
            setMalePriceId(litter.stripe_male_price_id || '');
            setFemalePriceId(litter.stripe_female_price_id || '');
        }
    }, [litter]);

    const handleUpdateLitter = (e: React.FormEvent) => {
        e.preventDefault();
        updateLitterMutation.mutate({
            stripe_male_price_id: malePriceId,
            stripe_female_price_id: femalePriceId,
        });
    };

    const handlePuppyFormComplete = () => {
        queryClient.invalidateQueries({ queryKey: ['litterWithPuppies', litterId] });
        setShowPuppyForm(false);
        setEditingPuppy(null);
        toast({
            title: "Success",
            description: "Puppy list updated.",
        });
    }

    const handleLitterFormComplete = (updatedLitter: any) => {
        queryClient.invalidateQueries({ queryKey: ['litterWithPuppies', litterId] });
        setEditingLitter(false);
        toast({
            title: "Success",
            description: "Litter updated successfully.",
        });
    }

    const handleDeletePuppy = async (puppyId: string) => {
        try {
            // First, remove puppy from any order items to avoid foreign key violations on puppy deletion.
            const { error: orderItemError } = await supabase
                .from('order_items')
                .delete()
                .eq('puppy_id', puppyId);

            if (orderItemError) throw orderItemError;
            
            // Now, delete the puppy itself.
            const { error } = await supabase.from('puppies').delete().eq('id', puppyId);
            if (error) throw error;
            toast({
                title: "Success",
                description: "Puppy deleted.",
            });
            queryClient.invalidateQueries({ queryKey: ['litterWithPuppies', litterId] });
        } catch (error: any) {
            toast({
                title: "Error",
                description: `Failed to delete puppy: ${error.message}`,
                variant: 'destructive',
            });
        }
    }

    const formatPrice = (priceInCents: number) => {
        if (typeof priceInCents !== 'number') return '$0.00';
        return (priceInCents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
        });
    };
    
    const getPuppyStatus = (puppy: ExtendedPuppy): 'available' | 'reserved' | 'sold' => {
        if (puppy.sold_to) return 'sold';
        if (puppy.reserved_by) return 'reserved';
        return 'available';
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{(error as Error).message}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!litter) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p>Litter not found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow container mx-auto px-4 py-8">
                <Link to="/admin" className="inline-flex items-center gap-2 mb-4 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Admin Dashboard
                </Link>
                
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Manage Litter: {litter.name}</h1>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="puppies">Puppies</TabsTrigger>
                        <TabsTrigger value="litter-details">Litter Details</TabsTrigger>
                        <TabsTrigger value="stripe-settings">Stripe Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="puppies" className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-semibold">Puppies Management</h2>
                            {!showPuppyForm && !editingPuppy && (
                                <Button onClick={() => setShowPuppyForm(true)}>Add Puppy</Button>
                            )}
                        </div>

                        {showPuppyForm ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Add New Puppy</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <PuppyForm 
                                        litterId={litter.id} 
                                        onComplete={handlePuppyFormComplete}
                                        onCancel={() => setShowPuppyForm(false)}
                                    />
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Puppies</CardTitle>
                                    <CardDescription>
                                        {litter.puppies.length > 0 ? `This litter has ${litter.puppies.length} puppies.` : 'No puppies have been added to this litter yet.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {litter.puppies.length > 0 ? (
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {litter.puppies.map(puppy => {
                                                const price = puppy.gender === 'male' ? litter.price_per_male : litter.price_per_female;
                                                const status = getPuppyStatus(puppy);

                                                return (
                                                <Card key={puppy.id}>
                                                    <CardContent className="p-4">
                                                        {puppy.image_url ? 
                                                            <img src={puppy.image_url} alt={puppy.name || 'Puppy'} className="w-full h-60 object-contain bg-muted rounded-md mb-4" />
                                                            : <div className="w-full h-60 bg-muted rounded-md mb-4 flex items-center justify-center text-muted-foreground">No Image</div>
                                                        }
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-semibold">{puppy.name || 'Unnamed Puppy'}</p>
                                                                <p className="text-sm text-muted-foreground capitalize">{puppy.gender}</p>
                                                            </div>
                                                            <span className="text-sm font-medium">{formatPrice(price)}</span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground capitalize mt-2">Status: {status}</p>
                                                        {puppy.stripe_price_id && <p className="text-xs text-muted-foreground mt-1 truncate">Stripe ID: {puppy.stripe_price_id}</p>}
                                                        <div className="flex gap-2 mt-4">
                                                            <Button variant="outline" size="sm" className="w-full" onClick={() => setEditingPuppy(puppy)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="destructive" size="sm" className="w-full">
                                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This action cannot be undone. This will permanently delete the puppy.
                                                                    </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeletePuppy(puppy.id)}>Continue</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )})}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground">Click "Add Puppy" to get started.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="litter-details" className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-semibold">Litter Details</h2>
                            <Button onClick={() => setEditingLitter(true)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Litter
                            </Button>
                        </div>

                        {editingLitter ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Edit Litter Details</CardTitle>
                                    <CardDescription>Update litter information, images, and other details.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <LitterForm
                                        litter={litter as any}
                                        breederId={litter.breeder_id || ''}
                                        onSave={handleLitterFormComplete}
                                        onCancel={() => setEditingLitter(false)}
                                    />
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Basic Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label className="font-semibold">Name:</Label>
                                            <p>{litter.name}</p>
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Breed:</Label>
                                            <p>{litter.breed}</p>
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Birth Date:</Label>
                                            <p>{new Date(litter.birth_date).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Status:</Label>
                                            <p className="capitalize">{litter.status}</p>
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Total Puppies:</Label>
                                            <p>{litter.total_puppies}</p>
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Available Puppies:</Label>
                                            <p>{litter.available_puppies}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Parents Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <Label className="font-semibold">Dam (Mother):</Label>
                                            <p>{litter.dam_name}</p>
                                            {litter.dam_image_url && (
                                                <img src={litter.dam_image_url} alt="Dam" className="w-32 h-32 object-cover rounded-md mt-2" />
                                            )}
                                        </div>
                                        <div>
                                            <Label className="font-semibold">Sire (Father):</Label>
                                            <p>{litter.sire_name}</p>
                                            {litter.sire_image_url && (
                                                <img src={litter.sire_image_url} alt="Sire" className="w-32 h-32 object-cover rounded-md mt-2" />
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="md:col-span-2">
                                    <CardHeader>
                                        <CardTitle>Pricing</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <Label className="font-semibold">Male Puppy Price:</Label>
                                                <p>{formatPrice(litter.price_per_male)}</p>
                                            </div>
                                            <div>
                                                <Label className="font-semibold">Female Puppy Price:</Label>
                                                <p>{formatPrice(litter.price_per_female)}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {litter.description && (
                                    <Card className="md:col-span-2">
                                        <CardHeader>
                                            <CardTitle>Description</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p>{litter.description}</p>
                                        </CardContent>
                                    </Card>
                                )}

                                {litter.image_url && (
                                    <Card className="md:col-span-2">
                                        <CardHeader>
                                            <CardTitle>Litter Image</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <img src={litter.image_url} alt="Litter" className="w-full max-w-md h-auto rounded-md" />
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="stripe-settings" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Litter Stripe Price IDs</CardTitle>
                                <CardDescription>Manage Stripe Price IDs for this litter. These are used for male/female pricing unless a puppy-specific ID is set.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleUpdateLitter} className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="malePriceId">Male Puppy Stripe Price ID</Label>
                                            <Input id="malePriceId" value={malePriceId} onChange={(e) => setMalePriceId(e.target.value)} placeholder="price_..."/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="femalePriceId">Female Puppy Stripe Price ID</Label>
                                            <Input id="femalePriceId" value={femalePriceId} onChange={(e) => setFemalePriceId(e.target.value)} placeholder="price_..."/>
                                        </div>
                                    </div>
                                    <Button type="submit" disabled={updateLitterMutation.isPending}>
                                        {updateLitterMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Stripe IDs
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={!!editingPuppy} onOpenChange={(isOpen) => !isOpen && setEditingPuppy(null)}>
                    <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Puppy</DialogTitle>
                            <DialogDescription>
                                Make changes to the puppy's details here. Click save when you're done.
                            </DialogDescription>
                        </DialogHeader>
                        {editingPuppy && (
                            <PuppyForm
                                litterId={litter.id}
                                puppyToEdit={editingPuppy as any}
                                onComplete={handlePuppyFormComplete}
                                onCancel={() => setEditingPuppy(null)}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </main>
            <Footer />
        </div>
    );
};

export default ManageLitterPage;
