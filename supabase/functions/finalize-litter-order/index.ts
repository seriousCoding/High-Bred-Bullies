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

    const { session_id } = await req.json();
    if (!session_id) throw new Error("Stripe Session ID is required.");

    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['line_items'] });
    if (session.payment_status !== 'paid') {
        throw new Error("Payment not successful.");
    }

    const { litterId, puppyIds: puppyIdsString, userId, deliveryOption, deliveryFee, deliveryZipCode } = session.metadata!;
    if (userId !== user.id) throw new Error("User mismatch.");

    const puppyIds = puppyIdsString.split(',');
    
    // Set scheduling deadline 15 days from now
    const scheduling_deadline = new Date();
    scheduling_deadline.setDate(scheduling_deadline.getDate() + 15);

    const newOrder = {
        user_id: user.id,
        stripe_session_id: session_id,
        stripe_payment_intent_id: session.payment_intent,
        total_amount: session.amount_total,
        subtotal_amount: session.amount_subtotal,
        discount_amount: session.total_details?.amount_discount ?? 0,
        status: 'paid',
        delivery_type: deliveryOption === 'delivery' ? 'delivery' : 'pickup',
        delivery_option: deliveryOption,
        delivery_cost: deliveryFee ? parseInt(deliveryFee) : 0,
        scheduling_deadline: scheduling_deadline.toISOString(),
        delivery_zip_code: deliveryZipCode,
    };

    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(newOrder)
        .select()
        .single();

    if (orderError) throw orderError;

    const order_items = puppyIds.map(puppy_id => ({
        order_id: order.id,
        puppy_id: puppy_id,
        price: 0, // Price is complex to get here, can be improved later
    }));

    const { error: orderItemsError } = await supabaseAdmin.from('order_items').insert(order_items);
    if (orderItemsError) throw orderItemsError;

    const { error: puppiesUpdateError } = await supabaseAdmin
        .from('puppies')
        .update({ is_available: false, sold_to: user.id })
        .in('id', puppyIds);

    if (puppiesUpdateError) throw puppiesUpdateError;
    
    const { data: purchasedPuppies } = await supabaseAdmin.from('puppies').select('id, name').in('id', puppyIds);

    return new Response(JSON.stringify({ order, puppies: purchasedPuppies, litterId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Finalize order error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
