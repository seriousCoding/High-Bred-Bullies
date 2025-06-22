
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resendApiKey = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!resendApiKey) {
    console.error("Missing RESEND_API_KEY environment variable.");
    return new Response(JSON.stringify({ error: "Server configuration error for email." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { order, userEmail, puppies } = await req.json();

    console.log(`Attempting to send confirmation email for order ${order.id} to: ${userEmail}`);
    
    const brandName = "High Bred Bullies";
    const scheduledDate = new Date(order.scheduled_date);
    const isDelivery = order.delivery_type === 'delivery';

    const baseUrl = new URL(req.url).origin;
    const puppyImageUrl = `${baseUrl}/lovable-uploads/8ab6b753-0e34-4baf-b9b7-6e01755a38c4.png`;

    const subject = isDelivery
        ? `Delivery Confirmation for Order #${order.id.substring(0, 8)}`
        : `Pickup Confirmation for Order #${order.id.substring(0, 8)}`;

    const formattedDate = format(scheduledDate, isDelivery ? "EEEE, MMMM dd, yyyy" : "EEEE, MMMM dd, yyyy 'at' h:mm a");

    const puppyList = puppies.map((p: any) => `<li style="margin-bottom: 5px;">${p.name || `Puppy #${p.id.substring(0,4)}`}</li>`).join('');

    const title = isDelivery ? "Your Puppy Delivery is Scheduled!" : "Your Puppy Pickup is Scheduled!";
    const intro = isDelivery
      ? "<p>Thank you for your order! Your delivery has been successfully scheduled. We will contact you to coordinate the exact time.</p>"
      : "<p>Thank you for your order! Your pickup has been successfully scheduled. Here are the details:</p>";
    
    const detailsTitle = isDelivery ? "Delivery Information" : "Pickup Information";
    const detailsContent = isDelivery
      ? `<p style="margin-bottom: 5px;"><strong>Date:</strong> ${formattedDate}</p><p>We will deliver to the area of ZIP code <strong>${order.delivery_zip_code}</strong>.</p>`
      : `<p style="margin-bottom: 5px;"><strong>Date & Time:</strong> ${formattedDate}</p>`;

    const outro = isDelivery
        ? "<p>We're so excited for you to meet your new furry family member(s). We will reach out soon to arrange the delivery time.</p>"
        : "<p>We're so excited for you to meet your new furry family member(s). Please make sure to arrive on time for your scheduled pickup.</p>";


    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
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
            animation: fadeIn 1s ease-in-out;
          }
          .content {
            padding: 30px 40px;
            color: #2d3748;
          }
          .content h1 {
            font-size: 26px;
            font-weight: 700;
            color: #1a202c;
            margin-top: 0;
            margin-bottom: 15px;
            animation: slideInUp 0.8s ease-out;
          }
          .content p, .content li {
            font-size: 16px;
            line-height: 1.7;
            margin-bottom: 15px;
          }
          .details-box {
            background-color: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }
          .details-box h2 {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin-top: 0;
            margin-bottom: 15px;
            border-bottom: 2px solid #cbd5e0;
            padding-bottom: 10px;
          }
          strong {
            font-weight: 600;
          }
          ul {
            padding-left: 20px;
            list-style-type: '🐶';
            margin: 0 0 15px 0;
          }
          ul li {
            padding-left: 10px;
          }
          .puppies-list h2 {
              font-size: 20px;
              font-weight: 600;
              margin-top: 25px;
              margin-bottom: 10px;
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
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideInUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h2 style="color: white; margin: 0; font-weight: 600;">${brandName}</h2>
          </div>
          <div class="puppy-hero">
            <img src="${puppyImageUrl}" alt="Your new puppy!">
          </div>
          <div class="content">
            <h1>${title}</h1>
            ${intro}
            
            <div class="details-box">
              <h2>${detailsTitle}</h2>
              ${detailsContent}
              <p style="margin-bottom: 0;"><strong>Order ID:</strong> #${order.id.substring(0, 8)}</p>
            </div>
            
            <div class="puppies-list">
              <h2>Your New Best Friend(s)</h2>
              <ul>
                ${puppyList}
              </ul>
            </div>
            
            ${outro}
          </div>
          <div class="footer">
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,</p>
            <p><strong>The ${brandName} Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${brandName} <onboarding@resend.dev>`,
            // Temporarily sending all emails to the verified Resend account email
            // due to sandbox limitations. In production, this should be [userEmail].
            to: ['rtownsend.appdesign.dev@gmail.com'],
            subject: subject,
            html: emailHtml,
        }),
    });

    if (!emailResponse.ok) {
        const errorBody = await emailResponse.text();
        throw new Error(`Resend API error: ${errorBody}`);
    }
    
    console.log(`Email sent successfully to rtownsend.appdesign.dev@gmail.com (original recipient: ${userEmail})`);

    return new Response(JSON.stringify({ message: "Confirmation email sent successfully." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Send email error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
