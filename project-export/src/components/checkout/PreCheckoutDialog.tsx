
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { LitterDetail } from '@/types';
import { Input } from '../ui/input';
import { toast } from 'sonner';

interface PreCheckoutDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  litter: LitterDetail;
  onConfirm: (deliveryOption: 'pickup' | 'delivery', deliveryZip?: string) => void;
  initialDeliveryOption: 'pickup' | 'delivery';
  initialDeliveryZip: string;
}

const PreCheckoutDialog = ({ 
  isOpen, 
  setIsOpen, 
  litter, 
  onConfirm,
  initialDeliveryOption,
  initialDeliveryZip,
}: PreCheckoutDialogProps) => {
  const [deliveryOption, setDeliveryOption] = useState(initialDeliveryOption);
  const [deliveryZip, setDeliveryZip] = useState(initialDeliveryZip);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [zipError, setZipError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDeliveryOption(initialDeliveryOption);
      setDeliveryZip(initialDeliveryZip);
      setZipError('');
      setTermsAgreed(false);
    }
  }, [isOpen, initialDeliveryOption, initialDeliveryZip]);

  const deliveryFee = litter.breeders?.delivery_fee ?? 0;
  const isDeliveryAvailable = !!litter.breeders?.delivery_areas && litter.breeders.delivery_areas.length > 0;

  const validateZip = (showToast = false) => {
    if (deliveryOption !== 'delivery') {
      setZipError('');
      return true;
    }

    if (!isDeliveryAvailable) {
      const errorMsg = 'Sorry, this breeder does not offer delivery.';
      setZipError(errorMsg);
      if (showToast) toast.error(errorMsg);
      return false;
    }

    const deliveryAreas = litter.breeders?.delivery_areas;
    if (!deliveryZip) {
      const errorMsg = 'Delivery ZIP code is required.';
      setZipError(errorMsg);
      if (showToast) toast.error(errorMsg);
      return false;
    }

    if (!deliveryAreas || !Array.isArray(deliveryAreas) || !deliveryAreas.includes(deliveryZip)) {
      const errorMsg = `Sorry, delivery is not available for this ZIP code. This breeder delivers to the following areas: ${deliveryAreas.join(', ')}.`;
      setZipError(errorMsg);
      if (showToast) toast.error(errorMsg);
      return false;
    }

    setZipError('');
    return true;
  };

  const handleConfirm = () => {
    if (termsAgreed) {
      if (deliveryOption === 'delivery' && !validateZip(true)) {
        return;
      }
      onConfirm(deliveryOption, deliveryZip);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Your Order</DialogTitle>
          <DialogDescription>Choose a delivery option and confirm the terms to proceed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <RadioGroup value={deliveryOption} onValueChange={(value) => {
            setDeliveryOption(value as 'pickup' | 'delivery');
            setZipError('');
          }}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pickup" id="pickup-dialog" />
              <Label htmlFor="pickup-dialog">Local Pickup (Free)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="delivery" id="delivery-dialog" />
              <Label htmlFor="delivery-dialog">Local Delivery {isDeliveryAvailable && deliveryFee > 0 && `(+$${(deliveryFee / 100).toFixed(2)})`}</Label>
            </div>
          </RadioGroup>

          {deliveryOption === 'delivery' && (
            <div className="pt-2">
              <Label htmlFor="zip-dialog">Delivery ZIP Code</Label>
              <Input 
                id="zip-dialog" 
                value={deliveryZip}
                onChange={(e) => {
                  setDeliveryZip(e.target.value);
                  setZipError('');
                }}
                onBlur={() => validateZip()}
                placeholder="Enter your ZIP code to check availability"
                className={zipError ? 'border-destructive' : ''}
              />
              {zipError && <p className="text-sm text-destructive mt-1">{zipError}</p>}
              {!zipError && isDeliveryAvailable && deliveryOption === 'delivery' && (
                  <p className="text-sm text-muted-foreground mt-1">
                      This breeder delivers to the following ZIP codes: {litter.breeders?.delivery_areas?.join(', ')}.
                  </p>
              )}
            </div>
          )}

          <Alert variant="default" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important: Pickup Policy</AlertTitle>
            <AlertDescription>
              You must schedule and complete the pickup of your puppy within <strong>15 days</strong> of purchase. Failure to do so may result in forfeiture of your payment.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center space-x-2 mt-4">
            <Checkbox id="terms-dialog" checked={termsAgreed} onCheckedChange={(checked) => setTermsAgreed(!!checked)} />
            <label
              htmlFor="terms-dialog"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand and agree to the 15-day pickup policy.
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!termsAgreed || (deliveryOption === 'delivery' && !deliveryZip)}>
            Confirm & Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreCheckoutDialog;
