
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createTransport } from "npm:nodemailer@6.9.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inquiry_id, name, email, subject, message } = await req.json();
    
    console.log('Sending inquiry notification for:', inquiry_id);

    // Get SMTP configuration from environment variables
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const fromEmail = Deno.env.get('FROM_EMAIL') || smtpUser;
    
    console.log('SMTP Configuration:', {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      hasPassword: !!smtpPass,
      fromEmail: fromEmail
    });
    
    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('SMTP configuration not complete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS');
    }

    // Create transporter with more reliable configuration
    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // Enhanced configuration for better reliability
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      pool: true,               // Use connection pooling
      maxConnections: 5,        // Max 5 connections
      maxMessages: 100,         // Max 100 messages per connection
      rateLimit: 14,            // Max 14 messages per second
    });

    // Test SMTP connection with retry logic
    let connectionVerified = false;
    let verifyAttempts = 0;
    const maxVerifyAttempts = 3;

    while (!connectionVerified && verifyAttempts < maxVerifyAttempts) {
      try {
        verifyAttempts++;
        console.log(`SMTP connection verification attempt ${verifyAttempts}...`);
        await transporter.verify();
        connectionVerified = true;
        console.log('SMTP connection verified successfully');
      } catch (verifyError) {
        console.error(`SMTP verification attempt ${verifyAttempts} failed:`, verifyError);
        if (verifyAttempts >= maxVerifyAttempts) {
          throw new Error(`SMTP connection failed after ${maxVerifyAttempts} attempts: ${verifyError.message}`);
        }
        // Wait 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Send confirmation email to the user who submitted the inquiry
    const userEmailOptions = {
      from: `"High Bred Bullies" <${fromEmail}>`,
      to: email,
      subject: 'Thank you for contacting High Bred Bullies',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Thank You for Your Inquiry</h2>
          
          <p>Hello ${name},</p>
          
          <p>Thank you for reaching out to High Bred Bullies. We have received your inquiry and will get back to you as soon as possible.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Your Message</h3>
            <p><strong>Subject:</strong> ${subject}</p>
            <p style="line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              We typically respond within 24 hours. If you have any urgent questions, please don't hesitate to call us.
            </p>
          </div>
          
          <p>Best regards,<br>High Bred Bullies Team</p>
        </div>
      `,
    };

    // Send notification email to admin
    const adminEmailOptions = {
      from: `"High Bred Bullies" <${fromEmail}>`,
      to: 'rtownsend.appdesign.dev@gmail.com',
      subject: `New Contact Form Inquiry: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Form Inquiry</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Contact Details</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #555;">Message</h3>
            <p style="line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              You can respond to this inquiry from your admin panel.
            </p>
          </div>
        </div>
      `,
    };

    let userEmailResult = null;
    let adminEmailResult = null;

    // Send confirmation email to user with retry logic
    let userEmailAttempts = 0;
    const maxEmailAttempts = 3;
    
    while (userEmailAttempts < maxEmailAttempts) {
      try {
        userEmailAttempts++;
        console.log(`Attempting to send user confirmation email (attempt ${userEmailAttempts})...`);
        userEmailResult = await transporter.sendMail(userEmailOptions);
        console.log('Confirmation email sent to user:', userEmailResult.messageId);
        break; // Success, exit loop
      } catch (error) {
        console.error(`User email attempt ${userEmailAttempts} failed:`, error);
        if (userEmailAttempts >= maxEmailAttempts) {
          console.error('Failed to send user confirmation email after all attempts');
        } else {
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Send notification email to admin with retry logic
    let adminEmailAttempts = 0;
    
    while (adminEmailAttempts < maxEmailAttempts) {
      try {
        adminEmailAttempts++;
        console.log(`Attempting to send admin notification email (attempt ${adminEmailAttempts})...`);
        adminEmailResult = await transporter.sendMail(adminEmailOptions);
        console.log('Admin notification sent successfully:', adminEmailResult.messageId);
        break; // Success, exit loop
      } catch (error) {
        console.error(`Admin email attempt ${adminEmailAttempts} failed:`, error);
        if (adminEmailAttempts >= maxEmailAttempts) {
          throw new Error(`Failed to send admin notification after ${maxEmailAttempts} attempts: ${error.message}`);
        } else {
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Close the transporter
    transporter.close();

    return new Response(JSON.stringify({ 
      success: true, 
      userEmailId: userEmailResult?.messageId || null,
      adminEmailId: adminEmailResult?.messageId || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending inquiry notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
