
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
    const { postId, content, title } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Check content using OpenAI
    const moderationPrompt = `
    Analyze the following social media post content for a pet owner community. 
    Determine if it should be approved for public posting.
    
    APPROVE if the content is:
    - Pet-centric (about dogs, puppies, pet care, etc.)
    - Positive testimonials or reviews
    - Helpful pet-related information
    - Family-friendly pet stories
    
    REJECT if the content contains:
    - Derogatory language
    - Defamatory statements
    - Racially charged content
    - Inappropriate language
    - Non-pet related content
    - Spam or promotional content
    
    Title: ${title}
    Content: ${content}
    
    Respond with either "APPROVE" or "REJECT" followed by a brief reason.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a content moderator for a pet community platform.' },
          { role: 'user', content: moderationPrompt }
        ],
        temperature: 0.1,
      }),
    });

    const aiResult = await response.json();
    const moderationResult = aiResult.choices[0].message.content;
    
    const isApproved = moderationResult.toUpperCase().startsWith('APPROVE');
    const status = isApproved ? 'approved' : 'rejected';
    const rejectionReason = isApproved ? null : moderationResult;

    // Update the post with moderation result
    const { error } = await supabaseClient
      .from('social_posts')
      .update({ 
        moderation_status: status,
        rejection_reason: rejectionReason
      })
      .eq('id', postId);

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true, 
        status,
        reason: rejectionReason 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Content moderation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
