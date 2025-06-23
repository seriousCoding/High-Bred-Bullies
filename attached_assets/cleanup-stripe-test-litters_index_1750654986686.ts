
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
    // 1. Find all test products in Stripe (active and inactive) by metadata tag.
    const activeProducts = await stripe.products.list({ limit: 100, active: true });
    const inactiveProducts = await stripe.products.list({ limit: 100, active: false });
    const allProducts = [...activeProducts.data, ...inactiveProducts.data];
    const testProducts = allProducts.filter(p => p.metadata.test_data === 'true');
    const testLitterIds = [...new Set(testProducts.map(p => p.metadata.litter_id).filter(Boolean))];

    if (testProducts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No test litters found to clean up.' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (testLitterIds.length > 0) {
      // 2. Find all puppies associated with test litters.
      const { data: puppies, error: puppiesError } = await supabaseAdmin
        .from('puppies')
        .select('id')
        .in('litter_id', testLitterIds);

      if (puppiesError) {
        console.error('Error fetching puppies for cleanup:', puppiesError.message);
      }

      if (puppies && puppies.length > 0) {
        const puppyIds = puppies.map(p => p.id);
        
        // 3. Delete associated order items to prevent foreign key violations.
        const { error: deleteOrderItemsError } = await supabaseAdmin
          .from('order_items')
          .delete()
          .in('puppy_id', puppyIds);

        if (deleteOrderItemsError) {
          console.error('Error deleting order items:', deleteOrderItemsError.message);
        }
      }

      // 4. Delete test litters from Supabase. This should cascade to puppies.
      const { error: deleteLittersError } = await supabaseAdmin
        .from('litters')
        .delete()
        .in('id', testLitterIds);

      if (deleteLittersError) {
        console.error('Error deleting litters from Supabase:', deleteLittersError.message);
      }
    }

    // 5. Deactivate any active Stripe products.
    let deactivatedCount = 0;
    for (const product of testProducts) {
      if (product.active) {
        try {
          // Deactivating a product automatically deactivates its prices.
          await stripe.products.update(product.id, { active: false });
          deactivatedCount++;
        } catch (e) {
          console.error(`Failed to deactivate product ${product.id}:`, e.message);
        }
      }
    }
    
    return new Response(JSON.stringify({ success: true, message: `Cleaned up data for ${testProducts.length} test puppies. Deactivated ${deactivatedCount} active Stripe products.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Stripe cleanup function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
