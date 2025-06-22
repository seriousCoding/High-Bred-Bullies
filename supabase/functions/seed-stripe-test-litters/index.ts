
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

const generateAndUploadImage = async (prompt: string, fileName: string) => {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke(
      'generate-litter-images',
      { body: { prompt, fileName } }
    );
    if (error) {
      console.error(`Image generation failed for ${fileName}:`, error.message);
      return null;
    }
    return data.publicUrl;
  } catch (e) {
    console.error(`Caught exception during image generation for ${fileName}:`, e);
    return null;
  }
};

const testLittersData = [
  { name: 'Tough Guy Pitbulls', breed: 'Pitbull', total_puppies: 5, base_price: 70000 },
  { name: 'Sweetheart Pitbulls', breed: 'Pitbull', total_puppies: 5, base_price: 80000 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { breederId } = await req.json();
  if (!breederId) {
    return new Response(JSON.stringify({ error: "Breeder ID is required" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        enqueue({ type: 'log', message: 'Starting to seed test litters...' });

        for (const litterData of testLittersData) {
          enqueue({ type: 'log', message: `Creating litter: ${litterData.name}` });
          
          // Insert the litter first and get the ID
          const { data: newLitter, error: litterError } = await supabaseAdmin
            .from('litters')
            .insert({
              breeder_id: breederId,
              name: litterData.name,
              breed: litterData.breed,
              birth_date: new Date().toISOString().split('T')[0],
              status: 'active',
              price_per_male: litterData.base_price,
              price_per_female: litterData.base_price + 10000,
              total_puppies: litterData.total_puppies,
              available_puppies: litterData.total_puppies,
              dam_name: 'Test Dam',
              sire_name: 'Test Sire',
              description: `Test litter of ${litterData.breed} puppies for demonstration purposes.`
            })
            .select()
            .single();

          if (litterError) {
            enqueue({ type: 'error', message: `Failed to create litter: ${litterError.message}` });
            continue;
          }

          enqueue({ type: 'log', message: `Litter ${newLitter.id} created successfully.` });

          // Generate images for the litter
          enqueue({ type: 'log', message: 'Generating litter images...' });

          const imagePrompts = {
            litter: `A professional photograph of a group of five adorable, healthy ${litterData.breed} puppies playing together in a clean, bright setting.`,
            dam: `A professional portrait of a beautiful, healthy adult female ${litterData.breed}, the mother, looking caring and strong.`,
            sire: `A professional portrait of a handsome, muscular adult male ${litterData.breed}, the father, looking proud and majestic.`
          };

          const litterImageUrl = await generateAndUploadImage(imagePrompts.litter, `${newLitter.id}-litter.png`);
          const damImageUrl = await generateAndUploadImage(imagePrompts.dam, `${newLitter.id}-dam.png`);
          const sireImageUrl = await generateAndUploadImage(imagePrompts.sire, `${newLitter.id}-sire.png`);

          // Update litter with image URLs
          if (litterImageUrl || damImageUrl || sireImageUrl) {
            const updateData: any = {};
            if (litterImageUrl) updateData.image_url = litterImageUrl;
            if (damImageUrl) updateData.dam_image_url = damImageUrl;
            if (sireImageUrl) updateData.sire_image_url = sireImageUrl;

            await supabaseAdmin
              .from('litters')
              .update(updateData)
              .eq('id', newLitter.id);
            
            enqueue({ type: 'log', message: 'Litter images updated.' });
          }

          // Now create the puppies for this litter
          enqueue({ type: 'log', message: `Creating ${litterData.total_puppies} puppies for litter ${newLitter.id}...` });

          for (let i = 0; i < litterData.total_puppies; i++) {
            const gender = i < 3 ? 'male' : 'female';
            const puppyName = `${litterData.breed} Puppy ${i + 1}`;
            const puppyPriceAmount = litterData.base_price + (i * 1000);

            try {
              // Create Stripe product and price for each puppy
              const product = await stripe.products.create({
                name: puppyName,
                description: `A lovely ${litterData.breed} puppy from the ${litterData.name} litter.`,
                metadata: { 
                  app_managed: 'true', 
                  entity: 'puppy', 
                  test_data: 'true', 
                  litter_id: newLitter.id 
                }
              });

              const price = await stripe.prices.create({
                product: product.id,
                unit_amount: puppyPriceAmount,
                currency: "usd",
              });

              // Generate puppy image
              const puppyImagePrompt = `A professional, high-quality photograph of a single, cute ${gender} ${litterData.breed} puppy sitting happily on a neutral background.`;
              const puppyImageUrl = await generateAndUploadImage(puppyImagePrompt, `${newLitter.id}-puppy-${i + 1}.png`);

              // Insert the puppy into the database
              const { error: puppyError } = await supabaseAdmin
                .from('puppies')
                .insert({
                  litter_id: newLitter.id, // Use the actual litter ID we just created
                  name: puppyName,
                  gender,
                  is_available: true,
                  color: 'various',
                  stripe_price_id: price.id,
                  image_url: puppyImageUrl,
                });

              if (puppyError) {
                enqueue({ type: 'error', message: `Failed to create puppy ${i + 1}: ${puppyError.message}` });
                continue;
              }

              enqueue({ type: 'log', message: `Puppy ${i + 1} created successfully.` });

            } catch (error: any) {
              enqueue({ type: 'error', message: `Error creating puppy ${i + 1}: ${error.message}` });
              continue;
            }
          }

          enqueue({ type: 'log', message: `Litter ${litterData.name} seeded successfully with ${litterData.total_puppies} puppies.` });
        }

        enqueue({ type: 'success', message: '2 test litters with 5 puppies and AI-generated images each have been created.' });
        controller.close();
      } catch (error: any) {
        console.error("Stripe seed function stream error:", error);
        enqueue({ type: 'error', message: error.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
