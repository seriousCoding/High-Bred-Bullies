const nodemailer = require('nodemailer');

// Test Gmail SMTP directly to ensure delivery
async function testGmailDelivery() {
  console.log('Testing direct Gmail delivery...');
  
  // Using Gmail SMTP which has better deliverability
  const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'admin@firsttolaunch.com',
      pass: 'rTown$402'
    }
  });

  try {
    // First verify the connection
    await gmailTransporter.verify();
    console.log('Gmail SMTP connection verified');

    // Send test email
    const info = await gmailTransporter.sendMail({
      from: 'High Bred Bullies <admin@firsttolaunch.com>',
      to: 'gpass1979@gmail.com',
      subject: 'High Bred Bullies - Email System Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">High Bred Bullies Email Test</h2>
          <p>This email confirms the High Bred Bullies platform can deliver emails to your inbox.</p>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>System Status:</h3>
            <ul>
              <li>✓ SMTP Connection: Working</li>
              <li>✓ Authentication: Verified</li>
              <li>✓ Delivery: Testing now</li>
            </ul>
          </div>
          <p>If you receive this email, all inquiry and contact form notifications will work properly.</p>
          <p><strong>Test completed:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    console.log('✓ Gmail delivery successful:', info.messageId);
    console.log('Check your inbox at gpass1979@gmail.com');
    
    return true;
  } catch (error) {
    console.error('Gmail delivery failed:', error.message);
    
    // Fallback to original SMTP with enhanced configuration
    console.log('\nTrying original SMTP with enhanced settings...');
    
    const fallbackTransporter = nodemailer.createTransporter({
      host: 'mail.firsttolaunch.com',
      port: 587,
      secure: false,
      auth: { user: 'admin@firsttolaunch.com', pass: 'rTown$402' },
      tls: { rejectUnauthorized: false },
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5
    });

    try {
      const fallbackInfo = await fallbackTransporter.sendMail({
        from: 'High Bred Bullies <admin@firsttolaunch.com>',
        to: 'gpass1979@gmail.com',
        subject: 'High Bred Bullies - Fallback Email Test',
        text: 'This is a plain text test email from High Bred Bullies platform. If you receive this, the email system is working.',
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>High Bred Bullies - Email Test</h2>
            <p>This fallback email confirms delivery is working.</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          </div>
        `
      });
      
      console.log('✓ Fallback delivery successful:', fallbackInfo.messageId);
      return true;
    } catch (fallbackError) {
      console.error('All email methods failed:', fallbackError.message);
      return false;
    }
  }
}

testGmailDelivery();