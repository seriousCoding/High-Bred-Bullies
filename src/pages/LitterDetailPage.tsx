import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Loader2, AlertTriangle, Dog, Calendar, Users, Building, Tag, Heart, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LitterDetail, Puppy, QuantityDiscount } from '@/types';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ShoppingCart } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PreCheckoutDialog from '@/components/checkout/PreCheckoutDialog';

const fetchLitterDetail = async (litterId: string): Promise<LitterDetail> => {
  const { data, error } = await supabase
    .from('litters')
    .select(`
      *,
      breeders ( business_name, delivery_fee, delivery_areas ),
      puppies ( * )
    `)
    .eq('id', litterId)
    .single();

  if (error) {
    console.error("Error fetching litter details:", error);
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Litter not found");
  }

  return data as unknown as LitterDetail;
};

const PuppyCard = ({ puppy, price, onToggleSelection, isSelected, isLoadingPrice, breed }: { puppy: Puppy; price: number; onToggleSelection: (puppy: Puppy) => void; isSelected: boolean, isLoadingPrice: boolean, breed: string }) => {
    const puppyImageUrl = puppy.image_url || `https://placehold.co/400x300/e2e8f0/64748b?text=${encodeURIComponent(puppy.name || `${puppy.color} ${breed}`)}`;
    return (
        <Card className={`overflow-hidden flex flex-col ${isSelected ? 'ring-2 ring-primary' : ''}`}>
            <img src={puppyImageUrl} alt={puppy.name || "Puppy"} className="w-full h-48 object-cover" />
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>{puppy.name || `Puppy #${puppy.id.substring(0,4)}`}</span>
                    {puppy.is_available ?
                        <Badge variant="secondary" className="bg-green-100 text-green-800">Available</Badge> :
                        <Badge variant="destructive">Reserved</Badge>
                    }
                </CardTitle>
                <CardDescription>Color: {puppy.color}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow flex flex-col justify-end">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gender:</span>
                    <span className="font-medium capitalize">{puppy.gender}</span>
                </div>
                {isLoadingPrice ? 
                    <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div> :
                    <div className="text-2xl font-bold text-primary">${price > 0 ? (price / 100).toFixed(2) : 'Inquire'}</div>
                }
                <Button className="w-full" disabled={!puppy.is_available || price <= 0} onClick={() => onToggleSelection(puppy)}>
                    {puppy.is_available ? (
                      isSelected ? (
                        <>
                          <XCircle className="mr-2 h-4 w-4" />
                          Remove from Cart
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Add to Cart
                        </>
                      )
                    ) : (
                       "Reserved"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

const LitterDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPuppies, setSelectedPuppies] = useState<Puppy[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPreCheckoutOpen, setIsPreCheckoutOpen] = useState(false);
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryZip, setDeliveryZip] = useState('');
  const [zipError, setZipError] = useState('');

  const { data: litter, isLoading, error } = useQuery({
    queryKey: ['litterDetail', id],
    queryFn: () => fetchLitterDetail(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`litter-updates-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'puppies',
          filter: `litter_id=eq.${id}`,
        },
        (payload) => {
          console.log('Puppy update received!', payload);
          toast.info('Puppy availability has been updated.');
          queryClient.invalidateQueries({ queryKey: ['litterDetail', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const { data: puppyPrices, isLoading: isLoadingPrices } = useQuery<Record<string, number>>({
    queryKey: ['puppyPrices', id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-puppy-prices', {
        body: { litterId: id },
      });
      if (error) throw new Error(`Failed to fetch puppy prices: ${error.message}`);
      return data;
    },
    enabled: !!litter && (litter.price_per_male === 0 && litter.price_per_female === 0),
  });

  const getPuppyPrice = (puppy: Puppy) => {
    if (puppyPrices && puppyPrices[puppy.id]) {
      return puppyPrices[puppy.id];
    }
    return puppy.gender === 'male' ? litter?.price_per_male ?? 0 : litter?.price_per_female ?? 0;
  };

  const handleToggleSelection = (puppy: Puppy) => {
    setSelectedPuppies(prevSelected => {
      const isSelected = prevSelected.some(p => p.id === puppy.id);
      if (isSelected) {
        return prevSelected.filter(p => p.id !== puppy.id);
      } else {
        return [...prevSelected, puppy];
      }
    });
  };

  const initiateCheckout = async (deliveryOptionParam: 'pickup' | 'delivery', deliveryZipParam?: string) => {
    if (!user || !session) {
      toast.error('You must be logged in to proceed to checkout.');
      return;
    }

    if (selectedPuppies.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }
    
    const actualDeliveryOption = deliveryOptionParam;
    const actualDeliveryZip = deliveryZipParam;

    if (actualDeliveryOption === 'delivery') {
      const deliveryAreas = litter?.breeders?.delivery_areas;
      if (!actualDeliveryZip || !deliveryAreas || !deliveryAreas.includes(actualDeliveryZip)) {
        const errorMsg = 'Sorry, delivery is not available for this ZIP code.';
        setZipError(errorMsg);
        toast.error(errorMsg);
        setIsCheckingOut(false);
        return;
      }
      setZipError('');
    }

    setIsCheckingOut(true);

    // Refetch litter data to ensure availability before checkout
    const freshLitterData = await queryClient.fetchQuery({
        queryKey: ['litterDetail', id], 
        queryFn: () => fetchLitterDetail(id!)
    });

    if (!freshLitterData) {
        toast.error('Could not verify litter details. Please try again.');
        setIsCheckingOut(false);
        return;
    }

    const stillAvailablePuppies = selectedPuppies.filter(selectedPuppy => {
        const freshPuppyData = freshLitterData.puppies.find(p => p.id === selectedPuppy.id);
        return freshPuppyData && freshPuppyData.is_available;
    });

    if (stillAvailablePuppies.length !== selectedPuppies.length) {
        const unavailablePuppies = selectedPuppies.filter(p => !stillAvailablePuppies.some(ap => ap.id === p.id));
        const unavailableNames = unavailablePuppies.map(p => p.name || `Puppy #${p.id.substring(0,4)}`).join(', ');
        toast.error(`Sorry, ${unavailableNames} just became unavailable. Your cart has been updated.`);
        setSelectedPuppies(stillAvailablePuppies);
        setIsCheckingOut(false);
        return;
    }

    setIsPreCheckoutOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke('create-litter-checkout', {
        body: {
          litterId: freshLitterData.id,
          puppyIds: stillAvailablePuppies.map(p => p.id),
          deliveryOption: actualDeliveryOption,
          deliveryZipCode: actualDeliveryOption === 'delivery' ? actualDeliveryZip : undefined,
        },
      });

      if (error) { throw new Error(error.message); }
      if (data.error) { throw new Error(data.error); }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Could not retrieve checkout session.');
      }
    } catch (e: any) {
      toast.error(`Checkout failed: ${e.message}`);
      console.error('Checkout error:', e);
      setIsCheckingOut(false);
    }
  };

  const validateZipCode = (showToast = false) => {
    if (deliveryOption === 'delivery') {
      const deliveryAreas = litter?.breeders?.delivery_areas;
      if (!deliveryZip) {
        const errorMsg = 'Please enter a ZIP code for delivery.';
        setZipError(errorMsg);
        if (showToast) toast.error(errorMsg);
        return false;
      }
      if (!deliveryAreas || !deliveryAreas.includes(deliveryZip)) {
        const errorMsg = 'Sorry, delivery is not available for this ZIP code.';
        setZipError(errorMsg);
        if (showToast) toast.error(errorMsg);
        return false;
      }
    }
    setZipError('');
    return true;
  };

  const handleCheckoutClick = () => {
    if (!user) {
      toast.error('Please log in to purchase a puppy.');
      return;
    }
    if (!validateZipCode(true)) {
      return;
    }
    setIsPreCheckoutOpen(true);
  }

  const { subtotal, applicableDiscount, discountAmount, total } = React.useMemo(() => {
    if (!litter || selectedPuppies.length === 0) {
      return { subtotal: 0, applicableDiscount: null, discountAmount: 0, total: 0 };
    }

    const subtotalCalc = selectedPuppies.reduce((acc, puppy) => {
      const price = getPuppyPrice(puppy);
      return acc + price;
    }, 0);

    const quantityDiscounts: QuantityDiscount[] = litter.quantity_discounts || [];
    const sortedDiscounts = [...quantityDiscounts].sort((a, b) => b.quantity - a.quantity);
    const discount = sortedDiscounts.find(d => selectedPuppies.length >= d.quantity) || null;
    
    let discountAmt = 0;
    if (discount) {
      discountAmt = (subtotalCalc * discount.discount_percentage) / 100;
    }

    const totalCalc = subtotalCalc - discountAmt;
    
    return { subtotal: subtotalCalc, applicableDiscount: discount, discountAmount: discountAmt, total: totalCalc };
  }, [litter, selectedPuppies, puppyPrices]);
  
  const birthDate = litter ? new Date(litter.birth_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : null;

  const availablePuppies = litter?.puppies.filter(p => p.is_available).length || 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
       {litter && <PreCheckoutDialog 
          isOpen={isPreCheckoutOpen} 
          setIsOpen={setIsPreCheckoutOpen} 
          litter={litter} 
          onConfirm={initiateCheckout} 
          initialDeliveryOption={deliveryOption}
          initialDeliveryZip={deliveryZip}
        />}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Litter Details</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {litter && (
          <div>
            <div className="text-center mb-12 relative">
                <img src={litter.image_url || `https://placehold.co/800x400/e2e8f0/64748b?text=${encodeURIComponent(litter.breed)}`} alt={litter.name} className="w-full h-64 object-cover rounded-lg mb-4" />
                <h1 className="text-4xl md:text-5xl font-bold text-foreground font-['Playfair_Display']">{litter.name}</h1>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">{litter.breed}</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
                <div className="md:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                           <CardTitle>About this Litter</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <p className="text-muted-foreground">{litter.description || "No description provided."}</p>
                           <div className="mt-6 grid grid-cols-2 gap-4">
                               <div className="flex items-center"><Calendar className="mr-2 h-5 w-5 text-primary" /> <span>Born: {birthDate}</span></div>
                               <div className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> <span>{litter.puppies.length} Puppies Total</span></div>
                           </div>
                           <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="flex flex-col items-center">
                                   {litter.dam_image_url && <img src={litter.dam_image_url} alt={litter.dam_name} className="w-full h-40 object-cover rounded-md mb-2" />}
                                   <div className="flex items-center"><Dog className="mr-2 h-5 w-5 text-primary" /> <span>Dam: {litter.dam_name}</span></div>
                               </div>
                               <div className="flex flex-col items-center">
                                   {litter.sire_image_url && <img src={litter.sire_image_url} alt={litter.sire_name} className="w-full h-40 object-cover rounded-md mb-2" />}
                                   <div className="flex items-center"><Dog className="mr-2 h-5 w-5 text-primary" /> <span>Sire: {litter.sire_name}</span></div>
                               </div>
                           </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-4">
                     <Card className="bg-secondary/50">
                        <CardHeader>
                           <CardTitle>Availability</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                           <div className="flex items-center text-lg"><Heart className="mr-2 h-5 w-5 text-green-600" /> <span>{availablePuppies} puppies available</span></div>
                           <div className="flex items-center text-lg"><XCircle className="mr-2 h-5 w-5 text-red-600" /> <span>{litter.puppies.length - availablePuppies} puppies reserved</span></div>
                        </CardContent>
                     </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Breeder Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center"><Building className="mr-2 h-5 w-5 text-primary" /> <span>{litter.breeders?.business_name || 'Independent Breeder'}</span></div>
                        </CardContent>
                     </Card>
                      {selectedPuppies.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center">
                              <ShoppingCart className="mr-2 h-5 w-5" />
                              Your Cart
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              {selectedPuppies.map(p => (
                                <div key={p.id} className="flex justify-between items-center text-sm">
                                  <span>{p.name || `Puppy #${p.id.substring(0,4)}`} ({p.gender})</span>
                                  <span>${(getPuppyPrice(p) / 100).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            <hr />

                            <div className="space-y-2">
                              <Label className="font-medium">Delivery Option</Label>
                              <RadioGroup value={deliveryOption} onValueChange={(value) => {
                                setDeliveryOption(value as 'pickup' | 'delivery');
                                setZipError('');
                              }}>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="pickup" id="pickup" />
                                  <Label htmlFor="pickup">Pickup</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="delivery" id="delivery" disabled={!litter.breeders?.delivery_areas || litter.breeders.delivery_areas.length === 0} />
                                  <Label htmlFor="delivery" className={(!litter.breeders?.delivery_areas || litter.breeders.delivery_areas.length === 0) ? 'text-muted-foreground' : ''}>Local Delivery</Label>
                                </div>
                              </RadioGroup>
                              {deliveryOption === 'delivery' && (
                                <div className="pt-2">
                                  <Label htmlFor="zip">Delivery ZIP Code</Label>
                                  <Input 
                                    id="zip" 
                                    value={deliveryZip}
                                    onChange={(e) => {
                                      setDeliveryZip(e.target.value);
                                      setZipError('');
                                    }}
                                    onBlur={() => validateZipCode()}
                                    placeholder="Enter your ZIP code"
                                    className={zipError ? 'border-destructive' : ''}
                                  />
                                  {zipError && <p className="text-sm text-destructive mt-1">{zipError}</p>}
                                </div>
                              )}
                            </div>
                            <hr />

                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>${(subtotal / 100).toFixed(2)}</span>
                              </div>
                              {applicableDiscount && (
                                <div className="flex justify-between text-green-600">
                                  <span>Discount ({applicableDiscount.discount_percentage}%)</span>
                                  <span>-${(discountAmount / 100).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-base">
                                <span>Total</span>
                                <span>${(total / 100).toFixed(2)}</span>
                              </div>
                            </div>
                             <Button onClick={handleCheckoutClick} disabled={isCheckingOut || (deliveryOption === 'delivery' && !deliveryZip)} className="w-full">
                                {isCheckingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Proceed to Checkout'}
                             </Button>
                          </CardContent>
                        </Card>
                      )}
                </div>
            </div>

            <div>
                <h2 className="text-3xl font-bold text-center mb-8 font-['Playfair_Display']">Available Puppies</h2>
                 {litter.puppies.length > 0 ? (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {litter.puppies.map(puppy => (
                            <PuppyCard 
                              key={puppy.id} 
                              puppy={puppy} 
                              price={getPuppyPrice(puppy)}
                              isSelected={!!selectedPuppies.find(p => p.id === puppy.id)}
                              onToggleSelection={handleToggleSelection}
                              isLoadingPrice={isLoadingPrices}
                              breed={litter.breed}
                            />
                        ))}
                    </div>
                 ) : (
                    <p className="text-center text-muted-foreground">No puppies listed for this litter yet. Please check back soon!</p>
                 )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default LitterDetailPage;
