
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Topics for High Table social posts
const socialPostTopics = [
  "My puppy's first training session success!",
  "Best treats for positive reinforcement training",
  "Puppy socialization tips from my experience", 
  "How my dog changed my life for the better",
  "Funny puppy behavior that made me laugh today",
  "Training milestone: my dog learned a new trick!",
  "Pet-friendly places I discovered recently",
  "Health tip: keeping your dog's teeth clean",
  "Rainy day activities for energetic puppies",
  "The bond between my family and our new puppy",
  "Exercise routine that works for my breed",
  "Grooming tips I learned the hard way",
  "Why rescue dogs make amazing companions",
  "Puppy-proofing your home: what I missed",
  "Building confidence in shy or anxious dogs"
];

// Sample video URLs for demonstration
const sampleVideoUrls = [
  "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4"
];

const generateImageForPost = async (topic: string, content: string) => {
  try {
    console.log(`Generating image for topic: ${topic}`);
    
    // Create a more specific image prompt based on the topic and content
    let imagePrompt = "";
    
    if (topic.includes("training")) {
      imagePrompt = "A happy dog during a training session with their owner in a backyard, showing positive reinforcement with treats, bright natural lighting, realistic photo style";
    } else if (topic.includes("puppy") || topic.includes("new")) {
      imagePrompt = "An adorable puppy playing with toys in a cozy home setting, natural lighting, heartwarming scene, realistic photo style";
    } else if (topic.includes("health") || topic.includes("teeth")) {
      imagePrompt = "A dog having their teeth brushed or examined, showing good dental care, clean bright setting, realistic photo style";
    } else if (topic.includes("exercise") || topic.includes("activities")) {
      imagePrompt = "A dog enjoying outdoor exercise or play time, running or playing fetch, beautiful outdoor setting, action shot, realistic photo style";
    } else if (topic.includes("grooming")) {
      imagePrompt = "A dog being groomed or freshly groomed looking happy and clean, professional grooming setting, realistic photo style";
    } else if (topic.includes("rescue") || topic.includes("companions")) {
      imagePrompt = "A rescued dog looking happy and loved with their new family, warm home environment, emotional connection, realistic photo style";
    } else {
      imagePrompt = "A happy, healthy dog in a loving home environment with their family, warm natural lighting, realistic photo style showing the bond between pet and owner";
    }

    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-2',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024'
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('OpenAI Image API error:', errorText);
      return null;
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.data[0].url;
    
    console.log(`Generated image URL: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Generate 3-5 posts
    const numPosts = Math.floor(Math.random() * 3) + 3;
    const selectedTopics = socialPostTopics.sort(() => 0.5 - Math.random()).slice(0, numPosts);
    
    const posts = [];
    
    for (let i = 0; i < selectedTopics.length; i++) {
      const topic = selectedTopics[i];
      console.log(`Generating social post for topic: ${topic}`);
      
      const prompt = `
        You are a pet owner in the "High Table" community sharing your experience.
        Write a social media post about: "${topic}".
        
        The post should be:
        - Personal and authentic (written in first person)
        - 50-150 words
        - Engaging and relatable to other pet owners
        - Include practical tips or insights
        - Warm and friendly tone
        - Feel like a real social media post with some casual language
        
        Return ONLY the post content, no quotes or additional formatting.
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
            { role: 'system', content: 'You are a helpful pet owner sharing experiences in a community.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        console.error('OpenAI API error:', await response.text());
        continue;
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Decide if this should be a video post (30% chance)
      const isVideoPost = Math.random() < 0.3;
      let mediaUrl = null;

      if (isVideoPost) {
        // Use a sample video URL for video posts
        mediaUrl = sampleVideoUrls[Math.floor(Math.random() * sampleVideoUrls.length)];
        console.log(`Using video URL: ${mediaUrl}`);
      } else {
        // Generate image for this post
        mediaUrl = await generateImageForPost(topic, content);
      }

      posts.push({
        user_id: null,
        title: topic,
        content: content.trim(),
        image_url: mediaUrl,
        visibility: 'public' as 'public',
        moderation_status: 'approved' as 'approved',
        is_testimonial: Math.random() < 0.3 // 30% chance of being a testimonial
      });
    }

    // Insert all posts into the database
    const { error: dbError } = await supabaseAdmin
      .from('social_posts')
      .insert(posts);
    
    if (dbError) {
      console.error('Error saving social posts to database:', dbError);
      throw dbError;
    }
    
    console.log(`Successfully created ${posts.length} AI social posts with mixed media`);

    return new Response(JSON.stringify({ 
      message: "AI social posts generated successfully with mixed media!", 
      count: posts.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-social-posts function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
