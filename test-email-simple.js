const nodemailer = require('nodemailer');

// Test SMTP connection and send email
async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: 'mail.firsttolaunch.com',
    port: 587,
    secure: false,
    auth: {
      user: 'admin@firsttolaunch.com',
      pass: 'rTown$402'
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // Verify connection
    await transporter.verify();
    console.log('SMTP connection verified');

    // Send test email
    const info = await transporter.sendMail({
      from: 'High Bred Bullies <admin@firsttolaunch.com>',
      to: 'gpass1979@gmail.com',
      subject: 'Test Email from High Bred Bullies',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Email System Test</h1>
          <p>This email confirms that the High Bred Bullies email system is working correctly.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>If you receive this, inquiry notifications will work properly.</p>
        </div>
      `
    });

    console.log('Test email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email test failed:', error.message);
    return false;
  }
}

testEmail();