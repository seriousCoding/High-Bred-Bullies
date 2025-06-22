import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, fileName } = await req.json();
    if (!prompt || !fileName) {
      throw new Error("Missing 'prompt' or 'fileName' in request body");
    }

    if (!openAIApiKey) throw new Error("OPENAI_API_KEY is not set in environment variables.");
    if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Supabase environment variables are not set.");

    console.log(`Generating image for prompt: ${prompt}`);

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error('OpenAI API error:', errorBody);
      throw new Error(`OpenAI API request failed: ${openaiResponse.statusText}`);
    }

    const { data: openaiData } = await openaiResponse.json();
    const b64_json = openaiData[0].b64_json;
    
    const imageBytes = Uint8Array.from(atob(b64_json), c => c.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: 'image/png' });

    console.log(`Uploading image to Supabase storage: ${fileName}`);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
    });

    const { error: uploadError } = await supabaseAdmin.storage
      .from('litter-images')
      .upload(fileName, imageBlob, {
          contentType: 'image/png',
          upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from('litter-images').getPublicUrl(fileName);

    console.log(`Successfully generated and uploaded image: ${publicUrl}`);
    return new Response(JSON.stringify({ publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in generate-litter-images function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
