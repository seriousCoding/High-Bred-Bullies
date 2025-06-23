const nodemailer = require('nodemailer');

// Create SMTP transporter with your settings
const transporter = nodemailer.createTransport({
  host: 'mail.firsttolaunch.com',
  port: 587,
  secure: false,
  auth: {
    user: 'admin@firsttolaunch.com',
    pass: 'rTown$402'
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
  tls: {
    rejectUnauthorized: false
  }
});

async function sendContactFormEmail() {
  try {
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">New Contact Form Submission</h1>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> Demo User</p>
          <p><strong>Email:</strong> demo@example.com</p>
          <p><strong>Subject:</strong> Contact Form Test</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">This is a test message from the High Bred Bullies contact form. The SMTP email service is working correctly!</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: 'High Bred Bullies <admin@firsttolaunch.com>',
      to: 'gpass1979@gmail.com',
      subject: 'Contact Form: Test Message',
      html: emailHtml
    });

    console.log('✅ Contact form email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Email delivered to: gpass1979@gmail.com');
    
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
  }
}

sendContactFormEmail();