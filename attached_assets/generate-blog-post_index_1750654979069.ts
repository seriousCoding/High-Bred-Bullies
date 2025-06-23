
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
// The service_role key is required to call SECURITY DEFINER functions.
// It's automatically available in the edge function environment.
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// A list of potential topics for the blog posts
const blogTopics = [
  "Common Pet Diseases and Their Treatments",
  "The Importance of Regular Exercise for Your Dog",
  "Effective Puppy Training Tips for New Owners",
  "Choosing the Right Food for Your Pet's Breed and Age",
  "How to Socialize Your New Puppy Safely",
  "Understanding and Managing Pet Anxiety",
  "The Benefits of Pet Adoption vs. Buying",
  "Essential Grooming Practices for a Healthy Coat",
  "Creating a Pet-Friendly Home Environment",
  "Senior Pet Care: Keeping Your Older Companion Comfortable",
  "The Role of Microchipping in Pet Safety",
  "Dental Health for Pets: Why It Matters and How to Maintain It",
  "Fun and Engaging DIY Pet Toys",
  "Traveling with Your Pet: A Complete Guide",
  "Decoding Your Cat's Body Language",
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing environment variables: OPENAI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server configuration error." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const randomTopic = blogTopics[Math.floor(Math.random() * blogTopics.length)];

    console.log(`Generating blog post for topic: ${randomTopic}`);
    
    const prompt = `
      You are an expert pet care blogger for "High Bred (Hybrid) Bullies".
      Write a blog post about the topic: "${randomTopic}".
      The tone should be informative, friendly, and helpful.
      The article should be between 300 and 500 words.
      
      Please return the response as a single JSON object with the following keys:
      - "title": A catchy and SEO-friendly title for the blog post.
      - "content": The full blog post content in Markdown format.
      - "excerpt": A short, compelling summary of the article (max 50 words).
      - "category": The most relevant category from this list: "Health", "Training", "Nutrition", "General", "Lifestyle".
      - "author_name": A plausible author name for a pet blog, like "Dr. Paws" or "The Pawsitive Team".
      - "image_prompt": A detailed DALL-E prompt to generate a photorealistic and engaging image for this blog post. The prompt should describe a visually appealing scene related to the blog topic.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates pet-related blog content in a specific JSON format.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('OpenAI API error:', errorBody);
      throw new Error(`OpenAI API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const blogData = JSON.parse(data.choices[0].message.content);

    console.log('Generated blog data from AI:', blogData.title);
    console.log('Generating image with prompt:', blogData.image_prompt);

    // Generate Image using DALL-E 3
    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'dall-e-3',
            prompt: blogData.image_prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json',
            quality: 'standard',
        }),
    });

    if (!imageResponse.ok) {
        const errorBody = await imageResponse.text();
        console.error('OpenAI Image API error:', errorBody);
        throw new Error(`OpenAI Image API request failed with status ${imageResponse.status}: ${errorBody}`);
    }
    
    const imageData = await imageResponse.json();
    const image_b64 = imageData.data[0].b64_json;
    
    // Upload image to Supabase Storage
    const imageBlob = new Blob([decode(image_b64)], { type: 'image/png' });
    const imagePath = `public/${crypto.randomUUID()}.png`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('blog-images')
        .upload(imagePath, imageBlob, {
            contentType: 'image/png',
            upsert: false,
        });

    if (uploadError) {
        console.error('Error uploading image to storage:', uploadError);
        throw uploadError;
    }

    // Get public URL for the image
    const { data: publicUrlData } = supabaseAdmin.storage
        .from('blog-images')
        .getPublicUrl(uploadData.path);
        
    const imageUrl = publicUrlData.publicUrl;
    console.log('Image uploaded to:', imageUrl);


    // Call the database function to create the post
    const { error: dbError } = await supabaseAdmin.rpc('create_blog_post_from_ai', {
        post_title: blogData.title,
        post_content: blogData.content,
        post_excerpt: blogData.excerpt,
        post_category: blogData.category,
        post_image_url: imageUrl,
        post_author_name: blogData.author_name
    });
    
    if (dbError) {
        console.error('Error saving blog post to database:', dbError);
        throw dbError;
    }
    
    console.log('Successfully created blog post:', blogData.title);

    return new Response(JSON.stringify({ message: "Blog post generated successfully!", title: blogData.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-blog-post function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
