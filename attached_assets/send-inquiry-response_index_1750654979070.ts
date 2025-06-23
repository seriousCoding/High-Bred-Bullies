
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inquiry_id, customer_email, customer_name, original_subject, response } = await req.json();
    
    console.log('Sending inquiry response to:', customer_email);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || 'no-reply@highbredbullies.com';

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailData = {
      from: `High Bred Bullies <${fromEmail}>`,
      to: [customer_email],
      subject: `Re: ${original_subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Response to Your Inquiry</h2>
          
          <p>Hello ${customer_name},</p>
          
          <p>Thank you for reaching out to us. Here's our response to your inquiry:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Your Original Message</h3>
            <p><strong>Subject:</strong> ${original_subject}</p>
          </div>
          
          <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #555;">Our Response</h3>
            <p style="line-height: 1.6;">${response.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              If you have any additional questions, please don't hesitate to contact us again.
            </p>
          </div>
          
          <p>Best regards,<br>High Bred Bullies Team</p>
        </div>
      `,
    };

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();
    console.log('Response email sent successfully:', result);

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending inquiry response:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
