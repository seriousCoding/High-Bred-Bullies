import nodemailer from 'nodemailer';

// Test the email system with your actual SMTP settings
async function testEmailSystem() {
  console.log('🧪 TESTING EMAIL SYSTEM FROM SCRATCH');
  
  // Your actual SMTP configuration
  const transporter = nodemailer.createTransport({
    host: 'mail.firsttolaunch.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: 'admin@firsttolaunch.com',
      pass: 'rtownsend123!',
    },
    tls: {
      rejectUnauthorized: false,
    },
    debug: true,
    logger: true
  });

  try {
    // Test connection
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified');

    // Test email to user
    console.log('Sending test email to user...');
    const userResult = await transporter.sendMail({
      from: 'admin@firsttolaunch.com',
      to: 'inspiron_402@yahoo.com',
      subject: 'DIRECT EMAIL TEST - High Bred Bullies',
      html: `
        <h2>Direct Email System Test</h2>
        <p>This is a direct test of the email system bypassing the application.</p>
        <p>If you receive this, the SMTP server is working correctly.</p>
        <p>Time: ${new Date().toISOString()}</p>
      `,
      text: 'Direct email test from High Bred Bullies email system'
    });

    console.log('✅ User email sent:', {
      messageId: userResult.messageId,
      accepted: userResult.accepted,
      rejected: userResult.rejected,
      response: userResult.response
    });

    // Test email to admin
    console.log('Sending test email to admin...');
    const adminResult = await transporter.sendMail({
      from: 'admin@firsttolaunch.com',
      to: 'gpass1979@gmail.com',
      subject: 'DIRECT EMAIL TEST - Admin Notification',
      html: `
        <h2>Admin Email Test</h2>
        <p>This is a direct test email to the admin account.</p>
        <p>Time: ${new Date().toISOString()}</p>
      `,
      text: 'Direct admin email test'
    });

    console.log('✅ Admin email sent:', {
      messageId: adminResult.messageId,
      accepted: adminResult.accepted,
      rejected: adminResult.rejected,
      response: adminResult.response
    });

  } catch (error) {
    console.error('❌ Email test failed:', error);
  } finally {
    transporter.close();
  }
}

testEmailSystem();