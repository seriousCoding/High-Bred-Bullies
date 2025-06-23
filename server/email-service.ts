import nodemailer from 'nodemailer';

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

class EmailService {
  private transporter: any = null;
  private fromEmail = 'High Bred Bullies <noreply@highbredbullies.com>';

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    if (smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass) {
      this.transporter = nodemailer.createTransport(smtpConfig);
      console.log('Email service initialized with SMTP configuration');
    } else {
      console.warn('SMTP configuration incomplete - email functionality disabled');
      console.warn('Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
    }
  }

  async sendEmail({ to, subject, html, from }: EmailTemplate): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service not configured - skipping email send');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: from || this.fromEmail,
        to,
        subject,
        html,
      });

      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // Welcome email for new users
  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to High Bred Bullies!</h1>
        <p>Hi ${userName},</p>
        <p>Welcome to the High Bred Bullies community! We're excited to have you join our platform dedicated to American Bully breeding excellence.</p>
        
        <h2>What you can do:</h2>
        <ul>
          <li>Browse available litters and puppies</li>
          <li>Connect with professional breeders</li>
          <li>Join our High Table community discussions</li>
          <li>Stay updated on breeding practices and events</li>
        </ul>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        
        <p>Best regards,<br>The High Bred Bullies Team</p>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            This email was sent from High Bred Bullies. If you didn't create an account, please ignore this email.
          </p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Welcome to High Bred Bullies!',
      html,
    });
  }

  // Order confirmation email
  async sendOrderConfirmation(
    userEmail: string,
    userName: string,
    orderDetails: {
      orderId: string;
      puppyNames: string[];
      totalAmount: number;
      breederName: string;
    }
  ): Promise<boolean> {
    const { orderId, puppyNames, totalAmount, breederName } = orderDetails;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Order Confirmation</h1>
        <p>Hi ${userName},</p>
        <p>Thank you for your order! We've received your payment and are processing your request.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">Order Details</h2>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Breeder:</strong> ${breederName}</p>
          <p><strong>Puppies:</strong> ${puppyNames.join(', ')}</p>
          <p><strong>Total Amount:</strong> $${(totalAmount / 100).toFixed(2)}</p>
        </div>
        
        <p>Your breeder will be in touch soon with next steps for pickup or delivery arrangements.</p>
        
        <p>Best regards,<br>The High Bred Bullies Team</p>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Order Confirmation - ${orderId}`,
      html,
    });
  }

  // Breeder notification for new order
  async sendBreederOrderNotification(
    breederEmail: string,
    breederName: string,
    orderDetails: {
      orderId: string;
      customerName: string;
      customerEmail: string;
      puppyNames: string[];
      totalAmount: number;
    }
  ): Promise<boolean> {
    const { orderId, customerName, customerEmail, puppyNames, totalAmount } = orderDetails;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">New Order Received!</h1>
        <p>Hi ${breederName},</p>
        <p>You've received a new order through High Bred Bullies!</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">Order Details</h2>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
          <p><strong>Puppies:</strong> ${puppyNames.join(', ')}</p>
          <p><strong>Total Amount:</strong> $${(totalAmount / 100).toFixed(2)}</p>
        </div>
        
        <p>Please log into your dashboard to view full order details and contact the customer to arrange pickup or delivery.</p>
        
        <p>Best regards,<br>The High Bred Bullies Team</p>
      </div>
    `;

    return this.sendEmail({
      to: breederEmail,
      subject: `New Order - ${orderId}`,
      html,
    });
  }

  // Litter announcement email
  async sendLitterAnnouncement(
    subscriberEmail: string,
    litterDetails: {
      litterName: string;
      breed: string;
      breederName: string;
      availablePuppies: number;
      expectedDate: string;
    }
  ): Promise<boolean> {
    const { litterName, breed, breederName, availablePuppies, expectedDate } = litterDetails;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">New Litter Available!</h1>
        <p>Great news! A new litter has been announced that matches your interests.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">${litterName}</h2>
          <p><strong>Breed:</strong> ${breed}</p>
          <p><strong>Breeder:</strong> ${breederName}</p>
          <p><strong>Available Puppies:</strong> ${availablePuppies}</p>
          <p><strong>Expected Date:</strong> ${expectedDate}</p>
        </div>
        
        <p>Visit our platform to learn more and reserve your spot!</p>
        
        <p>Best regards,<br>The High Bred Bullies Team</p>
      </div>
    `;

    return this.sendEmail({
      to: subscriberEmail,
      subject: `New ${breed} Litter Available - ${litterName}`,
      html,
    });
  }

  // Contact form submission notification
  async sendContactFormNotification(
    formData: {
      name: string;
      email: string;
      subject: string;
      message: string;
    }
  ): Promise<boolean> {
    const { name, email, subject, message } = formData;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">New Contact Form Submission</h1>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: 'support@highbredbullies.com',
      subject: `Contact Form: ${subject}`,
      html,
    });
  }

  // Password reset email
  async sendPasswordReset(
    userEmail: string,
    userName: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Password Reset Request</h1>
        <p>Hi ${userName},</p>
        <p>We received a request to reset your password for your High Bred Bullies account.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Your Password
          </a>
        </div>
        
        <p>This link will expire in 1 hour for security reasons.</p>
        
        <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
        
        <p>Best regards,<br>The High Bred Bullies Team</p>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset Request',
      html,
    });
  }
}

export const emailService = new EmailService();
export default EmailService;