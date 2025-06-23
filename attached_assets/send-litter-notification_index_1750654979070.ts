
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LitterInfo {
  name: string;
  breed: string;
  id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing environment variables.");
    return new Response(JSON.stringify({ error: "Server configuration error." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);
    const { litter }: { litter: LitterInfo } = await req.json();
    const brandName = "High Bred Bullies";

    const { data: subscribers, error: dbError } = await supabaseAdmin
      .from('newsletter_subscriptions')
      .select('email, preferences');

    if (dbError) throw dbError;

    const recipients = subscribers
      .filter(s => s.preferences?.litter_notifications)
      .map(s => s.email);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers for litter notifications." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = new URL(req.url).origin;
    const litterImageUrl = `${baseUrl}/lovable-uploads/97b89769-205c-4570-ae41-c213d260d488.png`;
    const litterUrl = `${baseUrl}/litters/${litter.id}`;
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${brandName} <onboarding@resend.dev>`,
            to: recipients,
            subject: `New Litter Announcement: ${litter.name}!`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Litter Announcement: ${litter.name}!</title>
                <style>
                  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
                  body {
                    margin: 0;
                    padding: 0;
                    background-color: #f0f4f8;
                    font-family: 'Poppins', sans-serif;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                  }
                  .email-container {
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                  }
                  .header {
                    text-align: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px 0;
                  }
                  .puppy-hero img {
                    width: 100%;
                    height: auto;
                    display: block;
                  }
                  .content {
                    padding: 30px 40px;
                    color: #2d3748;
                    text-align: center;
                  }
                  .content h1 {
                    font-size: 26px;
                    font-weight: 700;
                    color: #1a202c;
                    margin-top: 0;
                    margin-bottom: 15px;
                  }
                  .content p {
                    font-size: 16px;
                    line-height: 1.7;
                    margin-bottom: 15px;
                  }
                  strong {
                    font-weight: 600;
                  }
                  .button {
                      display: inline-block;
                      padding: 14px 28px;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: #ffffff !important;
                      text-decoration: none;
                      border-radius: 8px;
                      font-weight: 600;
                      font-size: 16px;
                      margin-top: 20px;
                      transition: transform 0.2s ease-out;
                  }
                  .button:hover {
                      transform: scale(1.05);
                  }
                  .footer {
                    background-color: #edf2f7;
                    text-align: center;
                    padding: 25px 40px;
                    font-size: 14px;
                    color: #718096;
                  }
                  .footer p {
                    margin: 0 0 5px 0;
                  }
                </style>
              </head>
              <body>
                <div class="email-container">
                  <div class="header">
                    <h2 style="color: white; margin: 0; font-weight: 600;">${brandName}</h2>
                  </div>
                  <div class="puppy-hero">
                    <img src="${litterImageUrl}" alt="New litter of puppies!">
                  </div>
                  <div class="content">
                      <h1>A New Litter Has Arrived!</h1>
                      <p>We're thrilled to announce our newest litter of ${litter.breed} puppies: <strong>${litter.name}</strong>.</p>
                      <p>Come meet the adorable new arrivals and find your new best friend.</p>
                      <a href="${litterUrl}" class="button">View The Litter</a>
                  </div>
                  <div class="footer">
                      <p>If you have any questions, you can reply to this email.</p>
                      <p>Best regards,</p>
                      <p><strong>The ${brandName} Team</strong></p>
                  </div>
                </div>
              </body>
              </html>
            `,
        }),
    });

    if (!emailResponse.ok) {
        const errorBody = await emailResponse.text();
        throw new Error(`Resend API error: ${errorBody}`);
    }

    return new Response(JSON.stringify({ message: "Notification emails sent successfully!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-litter-notification function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
