
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      name,
      description,
      price_per_male,
      price_per_female,
      stripe_product_id,
      stripe_male_price_id,
      stripe_female_price_id,
    } = await req.json();

    let productId = stripe_product_id;

    const productPayload = {
      name,
      description: description || `Litter of ${name}`,
      metadata: {
        app_managed: 'true',
        entity: 'litter',
      }
    };

    if (productId) {
      await stripe.products.update(productId, productPayload);
    } else {
      const product = await stripe.products.create(productPayload);
      productId = product.id;
    }

    if (stripe_male_price_id) {
      await stripe.prices.update(stripe_male_price_id, { active: false });
    }
    if (stripe_female_price_id) {
      await stripe.prices.update(stripe_female_price_id, { active: false });
    }

    const malePrice = await stripe.prices.create({
      product: productId,
      unit_amount: price_per_male,
      currency: "usd",
      metadata: { gender: 'male' },
    });

    const femalePrice = await stripe.prices.create({
      product: productId,
      unit_amount: price_per_female,
      currency: "usd",
      metadata: { gender: 'female' },
    });

    return new Response(
      JSON.stringify({
        stripe_product_id: productId,
        stripe_male_price_id: malePrice.id,
        stripe_female_price_id: femalePrice.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
