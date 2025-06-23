
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
    const { userId, puppyId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user already has a pet owner profile
    const { data: existingOwner } = await supabaseClient
      .from('pet_owners')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!existingOwner) {
      // Create pet owner profile
      const { error: ownerError } = await supabaseClient
        .from('pet_owners')
        .insert({
          user_id: userId,
          puppy_id: puppyId,
          adoption_date: new Date().toISOString().split('T')[0]
        });

      if (ownerError) throw ownerError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Create pet owner profile error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
