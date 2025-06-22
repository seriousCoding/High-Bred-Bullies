
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const { litterId } = await req.json();
    if (!litterId) throw new Error("Litter ID is required.");

    const { data: puppies, error: puppiesError } = await supabaseAdmin
        .from('puppies')
        .select('id, stripe_price_id')
        .eq('litter_id', litterId);

    if (puppiesError) throw puppiesError;

    const puppiesWithStripePrice = puppies.filter(p => p.stripe_price_id);
    
    if (puppiesWithStripePrice.length === 0) {
        return new Response(JSON.stringify({}), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    const pricePromises = puppiesWithStripePrice.map(p => stripe.prices.retrieve(p.stripe_price_id!));
    const stripePrices = await Promise.all(pricePromises);

    const puppyPrices: { [key: string]: number | null } = {};
    stripePrices.forEach((price, index) => {
        const puppyId = puppiesWithStripePrice[index].id;
        puppyPrices[puppyId] = price.unit_amount;
    });

    return new Response(JSON.stringify(puppyPrices), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Get puppy prices function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
