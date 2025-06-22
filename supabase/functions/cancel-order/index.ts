
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError) throw userError;
    if (!user) throw new Error("User not found");

    const { order_id } = await req.json();
    if (!order_id) throw new Error("Order ID is required.");

    console.log(`Starting order cancellation for order: ${order_id}`);

    // 2. Verify user is the breeder for this order and get puppy IDs
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        status,
        order_items (
          puppy_id,
          puppies (
            id,
            litters (
              breeders (
                user_id
              )
            )
          )
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError) throw orderError;
    if (!orderData) throw new Error("Order not found.");

    console.log(`Order found with status: ${orderData.status}`);

    // Check if order is already cancelled or archived
    if (['cancelled', 'archived'].includes(orderData.status)) {
      throw new Error("Order is already cancelled or archived.");
    }

    const breederUserIds = new Set(
        (orderData.order_items as any[])
            .map((oi: any) => oi.puppies?.litters?.breeders?.user_id)
            .filter(Boolean)
    );

    if (breederUserIds.size === 0) {
      // If no puppies, verify user is a breeder
      const { data: breeder } = await supabaseAdmin.from('breeders').select('id').eq('user_id', user.id).single();
      if (!breeder) throw new Error("Permission denied. Could not verify you as the breeder for this order.");
    } else if (!breederUserIds.has(user.id)) {
      throw new Error("Permission denied. You are not the breeder for this order.");
    }

    console.log(`Permission verified for user: ${user.id}`);

    const puppyIds = (orderData.order_items as any[]).map((item: any) => item.puppy_id).filter(Boolean);
    console.log(`Found puppies to make available: ${puppyIds.length}`);

    // 3. Update puppies to be available again
    if (puppyIds.length > 0) {
      const { error: puppiesUpdateError } = await supabaseAdmin
        .from('puppies')
        .update({ is_available: true, sold_to: null, reserved_by: null })
        .in('id', puppyIds);
      if (puppiesUpdateError) throw puppiesUpdateError;
      console.log(`Updated ${puppyIds.length} puppies to be available`);
    }
    
    // 4. Update order status to 'cancelled' and set updated_at
    const { data: updatedOrder, error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single();

    if (orderUpdateError) throw orderUpdateError;

    console.log(`Order ${order_id} successfully cancelled`);

    return new Response(JSON.stringify({ 
      order: updatedOrder,
      puppies_made_available: puppyIds.length,
      message: "Order cancelled successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Cancel order error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
