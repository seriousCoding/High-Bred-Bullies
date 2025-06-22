
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
    const { stripe_product_id } = await req.json();

    if (!stripe_product_id) {
      throw new Error("Stripe product ID is required.");
    }

    // Deactivate all prices for this product before deleting the product.
    const prices = await stripe.prices.list({ product: stripe_product_id, active: true });

    for (const price of prices.data) {
      await stripe.prices.update(price.id, { active: false });
    }

    // Now delete the product
    const deletedProduct = await stripe.products.del(stripe_product_id);

    return new Response(
      JSON.stringify({ success: true, deletedProduct }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Stripe delete function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
