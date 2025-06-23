
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, old_status, new_status, old_scheduled_date, new_scheduled_date, old_delivery_address, new_delivery_address, old_notes, new_notes } = await req.json();
    
    console.log('Sending order update notification for:', order_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order details and customer info
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        user_profiles!inner(first_name, last_name),
        order_items(
          puppies(name, gender, color, litters(name))
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !orderData) {
      console.error('Error fetching order:', orderError);
      throw new Error('Order not found');
    }

    // Get user email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(orderData.user_id);
    
    if (userError || !userData.user?.email) {
      console.error('Error fetching user email:', userError);
      throw new Error('User email not found');
    }

    const customerEmail = userData.user.email;
    const customerName = `${orderData.user_profiles.first_name} ${orderData.user_profiles.last_name}`;
    
    // Build changes summary
    let changes = [];
    if (old_status !== new_status) {
      changes.push(`Status: ${old_status} → ${new_status}`);
    }
    if (old_scheduled_date !== new_scheduled_date) {
      const oldDate = old_scheduled_date ? new Date(old_scheduled_date).toLocaleDateString() : 'Not scheduled';
      const newDate = new_scheduled_date ? new Date(new_scheduled_date).toLocaleDateString() : 'Not scheduled';
      changes.push(`Scheduled Date: ${oldDate} → ${newDate}`);
    }
    if (old_delivery_address !== new_delivery_address) {
      changes.push(`Delivery Address: ${old_delivery_address || 'Not set'} → ${new_delivery_address || 'Not set'}`);
    }
    if (old_notes !== new_notes) {
      changes.push(`Notes updated`);
    }

    const puppyNames = orderData.order_items.map(item => item.puppies.name).join(', ');

    const emailData = {
      from: 'High Bred Bullies <no-reply@highbredbullies.com>',
      to: [customerEmail],
      subject: `Order Update - ${order_id.substring(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Order Update Notification</h2>
          
          <p>Hello ${customerName},</p>
          
          <p>Your order has been updated. Here are the details:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Order Information</h3>
            <p><strong>Order ID:</strong> ${order_id}</p>
            <p><strong>Puppies:</strong> ${puppyNames}</p>
            <p><strong>Current Status:</strong> ${new_status}</p>
            ${new_scheduled_date ? `<p><strong>Scheduled Date:</strong> ${new Date(new_scheduled_date).toLocaleDateString()}</p>` : ''}
            ${new_delivery_address ? `<p><strong>Delivery Address:</strong> ${new_delivery_address}</p>` : ''}
          </div>
          
          ${changes.length > 0 ? `
          <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #555;">Changes Made</h3>
            <ul style="line-height: 1.6;">
              ${changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${new_notes ? `
          <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Notes</h3>
            <p style="line-height: 1.6;">${new_notes.replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}
          
          <p>If you have any questions about your order, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>High Bred Bullies Team</p>
        </div>
      `,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', errorData);
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = await response.json();
    console.log('Order update email sent successfully:', result);

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending order update notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
