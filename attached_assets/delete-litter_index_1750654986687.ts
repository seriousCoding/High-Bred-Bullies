
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { litterId } = await req.json();

    if (!litterId) {
      throw new Error("Litter ID is required.");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get litter details to check for Stripe IDs
    const { data: litter, error: litterError } = await supabaseClient
      .from("litters")
      .select("stripe_product_id")
      .eq("id", litterId)
      .single();

    if (litterError) throw litterError;

    // Delete from Stripe if product exists
    if (litter.stripe_product_id) {
      const { error: stripeError } = await supabaseClient.functions.invoke(
        'delete-stripe-litter',
        { body: { stripe_product_id: litter.stripe_product_id } }
      );
      
      if (stripeError) {
        console.error("Error deleting from Stripe:", stripeError);
        // Continue with database deletion even if Stripe fails
      }
    }

    // Delete puppies first (due to foreign key constraints)
    const { error: puppiesError } = await supabaseClient
      .from("puppies")
      .delete()
      .eq("litter_id", litterId);

    if (puppiesError) throw puppiesError;

    // Delete the litter
    const { error: deleteError } = await supabaseClient
      .from("litters")
      .delete()
      .eq("id", litterId);

    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({ success: true, message: "Litter deleted successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Delete litter function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
