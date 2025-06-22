import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError) throw userError;
    if (!user) throw new Error("User not found");

    const { litterId, puppyIds, deliveryOption, deliveryZipCode } = await req.json();
    if (!litterId || !puppyIds || puppyIds.length === 0 || !deliveryOption) {
      throw new Error("Litter ID, puppy IDs, and delivery option are required.");
    }

    const { data: litter, error: litterError } = await supabaseAdmin
      .from("litters")
      .select("*, breeders(delivery_fee, delivery_areas)")
      .eq("id", litterId)
      .single();
    if (litterError || !litter) throw new Error("Litter not found.");

    const { data: puppies, error: puppiesError } = await supabaseAdmin
      .from("puppies")
      .select("*")
      .in("id", puppyIds);
    if (puppiesError || !puppies || puppies.length !== puppyIds.length) {
      throw new Error("One or more puppies could not be found.");
    }

    puppies.forEach(p => {
      if (!p.is_available) throw new Error(`Puppy ${p.name || p.id} is no longer available.`);
      if (p.litter_id !== litterId) throw new Error(`Puppy ${p.name || p.id} does not belong to this litter.`);
    });

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = puppies.map(puppy => {
      let priceId = puppy.stripe_price_id;

      if (!priceId) {
        priceId = puppy.gender === 'male' ? litter.stripe_male_price_id : litter.stripe_female_price_id;
      }

      if (!priceId) {
        throw new Error(`Could not determine Stripe price for puppy ${puppy.name || puppy.id}.`);
      }
      
      return { price: priceId, quantity: 1 };
    });

    let deliveryFee = 0;
    if (deliveryOption === 'delivery') {
        if (!deliveryZipCode) {
            throw new Error("Delivery ZIP code is required for delivery.");
        }
        // @ts-ignore
        const deliveryAreas = litter.breeders?.delivery_areas as string[] | undefined;
        if (!deliveryAreas || !deliveryAreas.includes(deliveryZipCode)) {
            throw new Error(`Delivery not available for ZIP code ${deliveryZipCode}.`);
        }

        // @ts-ignore
        deliveryFee = (litter.breeders?.delivery_fee as number) || 0;
        if (deliveryFee > 0) {
            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Local Delivery Fee' },
                    unit_amount: deliveryFee,
                },
                quantity: 1,
            });
        }
    }
    
    let couponId: string | undefined = undefined;
    const quantity = puppies.length;
    const quantityDiscounts = litter.quantity_discounts as unknown as {quantity: number, discount_percentage: number}[];

    if (quantityDiscounts && Array.isArray(quantityDiscounts)) {
      const sortedDiscounts = [...quantityDiscounts].sort((a, b) => b.quantity - a.quantity);
      const applicableDiscount = sortedDiscounts.find(d => quantity >= d.quantity);
      
      if (applicableDiscount && applicableDiscount.discount_percentage > 0) {
        const coupon = await stripe.coupons.create({
          percent_off: applicableDiscount.discount_percentage,
          duration: 'once',
          name: `${applicableDiscount.discount_percentage}% off for ${quantity} puppies`,
        });
        couponId = coupon.id;
      }
    }
    
    const { data: customerList } = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId;
    if (customerList.length > 0) {
        customerId = customerList[0].id;
    } else {
        const newCustomer = await stripe.customers.create({ email: user.email! });
        customerId = newCustomer.id;
    }

    const origin = req.headers.get("origin")!;
    const success_url = new URL(origin + "/schedule-pickup").toString();
    const cancel_url = new URL(origin + "/litters/" + litterId).toString();

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      line_items,
      success_url: success_url + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url,
      metadata: {
        litterId,
        puppyIds: puppyIds.join(','),
        userId: user.id,
        deliveryOption,
        deliveryFee: deliveryFee.toString(),
        deliveryZipCode: deliveryOption === 'delivery' ? deliveryZipCode : undefined,
      }
    };

    if (couponId) {
      sessionPayload.discounts = [{ coupon: couponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Create litter checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
