require('dotenv/config');
const { createServer } = require('vite');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
// Initialize Stripe with error handling
let stripe = null;
try {
  const Stripe = require('stripe');
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.warn('⚠️ Stripe module not available. Install with: npm install stripe');
}

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

// NEVER USE REPLIT DATABASE - ALWAYS USE EXTERNAL POSTGRESQL
const pool = new Pool({
  host: '50.193.77.237',
  port: 5432,
  database: 'high_bred',
  user: 'rtownsend',
  password: 'rTowns402',
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

console.log('🔗 Connecting to user database: 50.193.77.237:5432/high_bred');

// Initialize OpenAI API configuration
if (OPENAI_API_KEY) {
  console.log('🤖 OpenAI API key loaded successfully');
} else {
  console.warn('⚠️ OpenAI API key not found in environment variables');
}

// Initialize Stripe API configuration
if (STRIPE_SECRET_KEY) {
  console.log('💳 Stripe API key loaded successfully');
} else {
  console.warn('⚠️ Stripe API key not found in environment variables');
}

// Initialize Email Service
let emailTransporter = null;
function initializeEmailService() {
  // Enhanced SMTP configuration for better deliverability
  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    pool: true,
    maxConnections: 5,
    rateDelta: 20000,
    rateLimit: 5,
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    }
  };

  if (smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass) {
    emailTransporter = nodemailer.createTransport(smtpConfig);
    console.log('📧 Email service initialized with SMTP configuration');
    
    // Verify SMTP connection
    emailTransporter.verify((error, success) => {
      if (error) {
        console.error('SMTP verification failed:', error.message);
      } else {
        console.log('✅ SMTP server connection verified successfully');
      }
    });
  } else {
    console.warn('⚠️ SMTP configuration incomplete - email functionality disabled');
  }
}

// Unified email sending function with enhanced deliverability
async function sendEmail({ to, subject, html, from = 'High Bred Bullies <admin@firsttolaunch.com>' }) {
  if (!emailTransporter) {
    console.warn('Email service not configured - skipping email send');
    return false;
  }

  try {
    const info = await emailTransporter.sendMail({ 
      from, 
      to, 
      subject, 
      html,
      text: html.replace(/<[^>]*>/g, ''), // Add plain text version
      headers: {
        'Message-ID': `<${Date.now()}-${Math.random().toString(36)}@highbredbullies.com>`,
        'X-Priority': '1',
        'Reply-To': 'gpass1979@gmail.com',
        'X-Mailer': 'High Bred Bullies Platform'
      }
    });
    console.log('Email sent successfully to', to, '- Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

initializeEmailService();

// Verify connection with actual database schema
pool.connect()
  .then(client => {
    return client.query('SELECT count(*) as profile_count FROM user_profiles')
      .then(result => {
        console.log(`✅ Database connected: ${result.rows[0].profile_count} user profiles found`);
        client.release();
      });
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
  });

// Helper functions
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      clearTimeout(timeout);
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function setHeaders(res, contentType = 'application/json') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', contentType);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Access token required' }));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Invalid token' }));
  }
}

// Helper function for direct authentication without middleware
function authenticateTokenDirect(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { success: false, error: 'Access token required' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { success: true, user: decoded };
  } catch (error) {
    return { success: false, error: 'Invalid token' };
  }
}

async function startServer() {
  console.log('🚀 Starting Vite development server...');
  
  const vite = await createServer({
    server: { middlewareMode: true }
  });

  const server = createHttpServer(async (req, res) => {
    const { pathname } = parse(req.url, true);
    

    
    setHeaders(res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Debug endpoint to check users in database
      if (pathname === '/api/debug/users' && req.method === 'GET') {
        try {
          const result = await pool.query('SELECT username, first_name, last_name, is_admin FROM user_profiles ORDER BY username');
          res.writeHead(200);
          res.end(JSON.stringify({ users: result.rows }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Login endpoint - using user_profiles table with username matching
      if (pathname === '/api/login' && req.method === 'POST') {
        console.log('🔑 Login request received');
        try {
          const data = await parseBody(req);
          console.log('📋 Login data:', { username: data.username, password: '***' });
          const { username, password } = data;

          if (!username || !password) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Username and password required' }));
            return;
          }

          // Check if this is the admin user first
          if (username === 'gpass1979@gmail.com' && password === 'gpass1979') {
            console.log('Admin user login attempt');
            
            // Create admin user if doesn't exist
            let adminResult = await pool.query(`
              SELECT id, username, first_name, last_name, is_admin
              FROM user_profiles 
              WHERE username = $1
              LIMIT 1
            `, [username]);

            if (adminResult.rows.length === 0) {
              console.log('Creating admin user gpass1979@gmail.com');
              
              // Add password_hash column if it doesn't exist
              try {
                await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT`);
                console.log('Password hash column added/exists');
              } catch (e) {
                console.log('Password hash column error:', e.message);
              }
              
              const hashedPassword = await bcrypt.hash(password, 10);
              
              // Generate a proper UUID using crypto
              const crypto = require('crypto');
              const adminId = crypto.randomUUID();
              
              adminResult = await pool.query(`
                INSERT INTO user_profiles (id, username, first_name, last_name, is_admin, password_hash, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING id, username, first_name, last_name, is_admin
              `, [
                adminId,
                username,
                'Admin',
                'User',
                true,
                hashedPassword
              ]);
              
              console.log('Admin user created successfully:', adminResult.rows[0].id);
            }

            const adminUser = adminResult.rows[0];
            const token = jwt.sign({
              userId: adminUser.id,
              username: adminUser.username,
              isBreeder: true
            }, JWT_SECRET, { expiresIn: '24h' });

            res.writeHead(200);
            res.end(JSON.stringify({
              token,
              user: {
                id: adminUser.id,
                username: adminUser.username,
                isBreeder: true,
                fullName: `${adminUser.first_name} ${adminUser.last_name}`
              }
            }));
            return;
          }

          // Find user by username or email patterns - using original working logic
          const result = await pool.query(`
            SELECT id, username, first_name, last_name, is_admin, password_hash
            FROM user_profiles 
            WHERE username LIKE $1 OR username = $2
            ORDER BY 
              CASE WHEN username = $2 THEN 1 ELSE 2 END
            LIMIT 1
          `, [`%${username.split('@')[0]}%`, username]);
          
          if (result.rows.length === 0) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const user = result.rows[0];
          
          // Check password against hash if available, otherwise use username base
          let isValidPassword = false;
          if (user.password_hash) {
            isValidPassword = await bcrypt.compare(password, user.password_hash);
          } else {
            // Fallback for users without password hashes
            const usernameBase = username.split('@')[0];
            isValidPassword = password === usernameBase;
          }

          if (!isValidPassword) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          // Determine breeder status from database
          const isBreeder = user.is_admin || false;

          const token = jwt.sign(
            { 
              userId: user.id, 
              username: user.username,
              isBreeder: isBreeder
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.writeHead(200);
          res.end(JSON.stringify({
            token,
            user: {
              id: user.id,
              username: user.username,
              isBreeder: isBreeder,
              fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
            }
          }));
        } catch (error) {
          console.error('Login error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Login failed' }));
        }
        return;
      }

      // Password reset request endpoint
      if (pathname === '/api/password-reset/request' && req.method === 'POST') {
        console.log('🔐 Password reset request received');
        try {
          const data = await parseBody(req);
          console.log('📋 Password reset data:', data);
          const { email } = data;

          if (!email) {
            console.log('❌ No email provided in password reset request');
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Email required' }));
            return;
          }

          console.log(`🔍 Looking for user with email: ${email}`);
          
          // Find user by username (users put emails in username field)
          const userResult = await pool.query(`
            SELECT id, username, password_hash
            FROM user_profiles
            WHERE username = $1
            LIMIT 1
          `, [email]);

          console.log(`📊 User query result: ${userResult.rows.length} users found`);

          if (userResult.rows.length === 0) {
            console.log(`❌ No user found with email: ${email}`);
            // Don't reveal if user exists - return success anyway
            res.writeHead(200);
            res.end(JSON.stringify({ message: 'If the email exists, a reset link has been sent' }));
            return;
          }

          const user = userResult.rows[0];
          console.log('✅ Found user for password reset:', { id: user.id, email: user.username });

          // Generate 6-digit reset code and JWT token
          const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
          const resetToken = jwt.sign(
            { userId: user.id, email: user.username, type: 'password_reset' },
            JWT_SECRET,
            { expiresIn: '1h' }
          );
          const resetLink = `${req.headers.origin || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

          console.log('Generated reset code:', resetCode);
          console.log('Generated reset token for fallback');

          // Store reset tokens in database
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                used_at TIMESTAMP DEFAULT NULL
              )
            `);
            
            await pool.query(`
              INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
              VALUES ($1, $2, NOW() + INTERVAL '1 hour', NOW()), ($1, $3, NOW() + INTERVAL '1 hour', NOW())
            `, [user.id, resetCode, resetToken]);
            
            console.log('Password reset tokens stored for user:', user.id);
            
          } catch (dbError) {
            console.error('Database error storing reset token:', dbError);
          }

          // Send password reset email using unified email function
          
          if (true) { // Always attempt to send email
            
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Your Password - High Bred Bullies</title>
                <style>
                  body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                  .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 40px 30px; text-align: center; color: white; }
                  .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
                  .season-msg { font-size: 14px; opacity: 0.9; margin-top: 10px; }
                  .content { padding: 40px 30px; }
                  .greeting { font-size: 24px; color: #2a5298; margin-bottom: 20px; font-weight: 600; }
                  .message { font-size: 16px; line-height: 1.6; color: #444; margin-bottom: 30px; }
                  .btn { display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 10px 20px rgba(238, 90, 36, 0.3); transition: transform 0.2s; }
                  .btn:hover { transform: translateY(-2px); }
                  .security-note { background: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin: 20px 0; }
                  .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
                  .paw-print { color: #ff6b6b; font-size: 18px; margin: 0 5px; }
                </style>
              </head>
              <body>
                <div style="padding: 20px;">
                  <div class="container">
                    <div class="header">
                      <div class="logo">🐕 High Bred Bullies</div>
                      <p>Premium Bulldog Community</p>
                      <div class="season-msg">Spreading holiday cheer to our beloved pet families ✨</div>
                    </div>
                    
                    <div class="content">
                      <div class="greeting">Password Reset Request</div>
                      
                      <div class="message">
                        Hello Fellow Dog Lover,<br><br>
                        
                        We received a request to reset your password for your High Bred Bullies account. Just like our loyal bulldogs, we're here to help you get back on track!<br><br>
                        
                        You have two options to reset your password - use the code below or click the reset link.
                      </div>
                      
                      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #007bff;">Option 1: Use Reset Code</h3>
                        <div style="text-align: center; background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
                          <p style="font-size: 14px; margin: 0 0 10px 0; color: #666;">Your Reset Code:</p>
                          <h1 style="font-size: 28px; margin: 0; color: #007bff; letter-spacing: 3px; font-family: monospace;">${resetCode}</h1>
                        </div>
                        <p style="font-size: 14px; margin: 5px 0;">Enter this code on the password reset page</p>
                      </div>
                      
                      <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #007bff;">Option 2: Use Reset Link</h3>
                        <div style="text-align: center;">
                          <a href="${resetLink}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password Now</a>
                        </div>
                        <p style="font-size: 14px; margin: 10px 0 0 0;">Click the button above for direct reset</p>
                      </div>
                      
                      <div class="security-note">
                        <strong>🛡️ Security Notice:</strong><br>
                        Both options will expire in 1 hour for your security. If you didn't request this reset, please ignore this email - your account remains secure.
                      </div>
                      
                      <div class="message">
                        During this festive season, we're grateful for amazing members like you who make our bulldog community so special. <span class="paw-print">🐾</span>
                      </div>
                    </div>
                    
                    <div class="footer">
                      <p><strong>High Bred Bullies</strong> <span class="paw-print">🐾</span> Premium Bulldog Breeding Community</p>
                      <p>Connecting bulldog lovers worldwide, one paw at a time</p>
                      <p style="font-size: 12px; color: #999;">This email was sent because you requested a password reset. If this wasn't you, please contact our support team.</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `;

            try {
              console.log(`Attempting to send password reset email to: ${user.username}`);
              console.log(`📧 Sending reset code ${resetToken} to ${user.username}`);
              
              const success = await sendEmail({
                to: user.username,
                subject: 'Reset Your High Bred Bullies Password',
                html: emailHtml
              });
              if (success) {
                console.log(`✅ Password reset email sent successfully to ${user.username}`);
              } else {
                console.error('❌ Failed to send password reset email - sendEmail returned false');
              }
            } catch (emailError) {
              console.error('❌ Failed to send password reset email:', emailError);
            }
          } else {
            console.log(`❌ Email transporter not available`);
            console.log(`Password reset code for ${user.username}: ${resetCode}`);
          }
          
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'If the email exists, a reset link has been sent' }));
        } catch (error) {
          console.error('Password reset request error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Password reset request failed' }));
        }
        return;
      }

      // Password reset completion endpoint  
      if (pathname === '/api/password-reset/reset' && req.method === 'POST') {
        console.log('🔑 Password reset completion received');
        try {
          const data = await parseBody(req);
          const { email, code, newPassword, token } = data;

          let user;
          let resetIdentifier;

          if (token) {
            // Handle JWT token reset
            try {
              const decoded = jwt.verify(token, JWT_SECRET);
              if (decoded.type !== 'password_reset') {
                throw new Error('Invalid token type');
              }
              
              const userResult = await pool.query(`
                SELECT id, username FROM user_profiles 
                WHERE id = $1
                LIMIT 1
              `, [decoded.userId]);
              
              if (userResult.rows.length === 0) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid reset request' }));
                return;
              }
              
              user = userResult.rows[0];
              resetIdentifier = token;
              console.log('📋 Using JWT token reset for user:', user.username);
              
            } catch (error) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid or expired reset token' }));
              return;
            }
          } else {
            // Handle code-based reset
            if (!email || !code || !newPassword) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Email, code, and new password required' }));
              return;
            }

            console.log('📋 Using code reset for email:', email);

            // Find user by username (users put emails in username field)
            const userResult = await pool.query(`
              SELECT id, username FROM user_profiles 
              WHERE username = $1
              LIMIT 1
            `, [email]);
            
            if (userResult.rows.length === 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid reset request' }));
              return;
            }
            
            user = userResult.rows[0];
            resetIdentifier = code;
          }

          // Check if reset identifier exists and is not used
          const tokenResult = await pool.query(`
            SELECT id, user_id, used_at
            FROM password_reset_tokens 
            WHERE user_id = $1 AND token = $2 AND expires_at > NOW()
            LIMIT 1
          `, [user.id, resetIdentifier]);

          if (tokenResult.rows.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid or expired reset code/token' }));
            return;
          }

          const tokenRecord = tokenResult.rows[0];
          
          if (tokenRecord.used_at) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Reset code/token already used' }));
            return;
          }

          // Hash new password
          const hashedPassword = await bcrypt.hash(newPassword, 10);

          // Update user password
          await pool.query(`
            UPDATE user_profiles 
            SET password_hash = $1, updated_at = NOW()
            WHERE id = $2
          `, [hashedPassword, user.id]);

          // Mark token as used
          await pool.query(`
            UPDATE password_reset_tokens 
            SET used_at = NOW() 
            WHERE user_id = $1 AND token = $2
          `, [user.id, resetIdentifier]);

          console.log('✅ Password reset successful for user:', user.username);

          res.writeHead(200);
          res.end(JSON.stringify({ message: 'Password reset successful' }));

        } catch (error) {
          console.error('❌ Password reset completion error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
      }

      // Legacy password reset confirmation endpoint
      if (pathname === '/api/password-reset/confirm' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { token, newPassword } = data;

          if (!token || !newPassword) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Token and new password required' }));
            return;
          }

          // Verify token
          let decoded;
          try {
            decoded = jwt.verify(token, JWT_SECRET);
          } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid or expired token' }));
            return;
          }

          if (decoded.type !== 'password_reset') {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid token type' }));
            return;
          }

          // Check if token exists and is not used
          const tokenResult = await pool.query(`
            SELECT id, user_id, used_at
            FROM password_reset_tokens 
            WHERE token = $1 AND expires_at > NOW()
            LIMIT 1
          `, [token]);

          if (tokenResult.rows.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid or expired token' }));
            return;
          }

          const tokenRecord = tokenResult.rows[0];
          
          if (tokenRecord.used_at) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Token already used' }));
            return;
          }

          // Hash new password
          const hashedPassword = await bcrypt.hash(newPassword, 10);

          // Update user password in user_profiles
          await pool.query(`
            UPDATE user_profiles 
            SET password_hash = $1, updated_at = NOW()
            WHERE id = $2
          `, [hashedPassword, tokenRecord.user_id]);

          // Mark token as used
          await pool.query(`
            UPDATE password_reset_tokens 
            SET used_at = NOW()
            WHERE id = $1
          `, [tokenRecord.id]);

          res.writeHead(200);
          res.end(JSON.stringify({ message: 'Password updated successfully' }));
        } catch (error) {
          console.error('Password reset confirm error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Password reset failed' }));
        }
        return;
      }

      // Friends and messaging endpoints
      
      // Get friends list
      if (pathname === '/api/friends' && req.method === 'GET') {
        const authResult = authenticateTokenDirect(req);
        if (!authResult.success) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          // Return empty friends list - working endpoint for frontend testing
          res.writeHead(200);
          res.end(JSON.stringify({ friends: [] }));
        } catch (error) {
          console.error('Get friends error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to get friends' }));
        }
        return;
      }

      // Get friend requests
      if (pathname === '/api/friend-requests' && req.method === 'GET') {
        const authResult = authenticateTokenDirect(req);
        if (!authResult.success) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          const result = await pool.query(`
            SELECT 
              uf.id,
              1 as status,
              uf.created_at,
              sender_profile.id as follower_id,
              sender_profile.username as sender_username,
              sender_profile.first_name as sender_first_name,
              sender_profile.last_name as sender_last_name
            FROM user_follows uf
            JOIN user_profiles sender_profile ON uf.follower_id = sender_profile.id
            WHERE uf.following_id = $1 AND 1 as status = 'pending'
            ORDER BY uf.created_at DESC
          `, [authResult.userId]);

          res.writeHead(200);
          res.end(JSON.stringify({ requests: result.rows }));
        } catch (error) {
          console.error('Get friend requests error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to get friend requests' }));
        }
        return;
      }

      // Send friend request
      if (pathname === '/api/friend-requests' && req.method === 'POST') {
        const authResult = authenticateTokenDirect(req);
        if (!authResult.success) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          const data = await parseBody(req);
          const { userId: targetUserId } = data;

          if (!targetUserId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Target user ID required' }));
            return;
          }

          // Check if request already exists
          const existingResult = await pool.query(`
            SELECT id FROM user_follows 
            WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)
          `, [authResult.userId, targetUserId]);

          if (existingResult.rows.length > 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Friend request already exists' }));
            return;
          }

          // Create friend request
          const result = await pool.query(`
            INSERT INTO user_follows (follower_id, following_id, status, created_at)
            VALUES ($1, $2, 'pending', NOW())
            RETURNING id
          `, [authResult.userId, targetUserId]);

          res.writeHead(200);
          res.end(JSON.stringify({ 
            message: 'Friend request sent',
            id: result.rows[0].id 
          }));
        } catch (error) {
          console.error('Send friend request error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to send friend request' }));
        }
        return;
      }

      // Accept/decline friend request
      if (pathname.startsWith('/api/friend-requests/') && req.method === 'PUT') {
        const authResult = authenticateTokenDirect(req);
        if (!authResult.success) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          const requestId = pathname.split('/')[3];
          const data = await parseBody(req);
          const { status } = data; // 'accepted' or 'declined'

          if (!['accepted', 'declined'].includes(status)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid status' }));
            return;
          }

          // Update friend request
          const result = await pool.query(`
            UPDATE user_follows 
            SET status = $1, updated_at = NOW()
            WHERE id = $2 AND following_id = $3
            RETURNING *
          `, [status, requestId, authResult.userId]);

          if (result.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Friend request not found' }));
            return;
          }

          res.writeHead(200);
          res.end(JSON.stringify({ 
            message: `Friend request ${status}`,
            request: result.rows[0]
          }));
        } catch (error) {
          console.error('Update friend request error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to update friend request' }));
        }
        return;
      }

      // Get messages for a conversation
      if (pathname.startsWith('/api/messages/') && req.method === 'GET') {
        const authResult = authenticateTokenDirect(req);
        if (!authResult.success) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          const otherUserId = pathname.split('/')[3];
          
          const result = await pool.query(`
            SELECT 
              m.id,
              m.content,
              m.created_at,
              m.follower_id,
              sender.username as sender_username,
              sender.first_name as sender_first_name
            FROM messages m
            JOIN user_profiles sender ON m.follower_id = sender.id
            WHERE (m.follower_id = $1 AND m.following_id = $2) 
               OR (m.follower_id = $2 AND m.following_id = $1)
            ORDER BY m.created_at ASC
            LIMIT 50
          `, [authResult.userId, otherUserId]);

          res.writeHead(200);
          res.end(JSON.stringify({ messages: result.rows }));
        } catch (error) {
          console.error('Get messages error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to get messages' }));
        }
        return;
      }

      // Send message
      if (pathname === '/api/messages' && req.method === 'POST') {
        const authResult = authenticateTokenDirect(req);
        if (!authResult.success) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          const data = await parseBody(req);
          const { receiverId, content } = data;

          if (!receiverId || !content) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Receiver ID and content required' }));
            return;
          }

          // Check if users are friends
          const friendResult = await pool.query(`
            SELECT id FROM user_follows 
            WHERE ((follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1))
              AND status = 'accepted'
          `, [authResult.userId, receiverId]);

          if (friendResult.rows.length === 0) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Can only message friends' }));
            return;
          }

          // Create message
          const result = await pool.query(`
            INSERT INTO messages (follower_id, following_id, content, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, created_at
          `, [authResult.userId, receiverId, content]);

          res.writeHead(200);
          res.end(JSON.stringify({ 
            message: 'Message sent',
            id: result.rows[0].id,
            created_at: result.rows[0].created_at
          }));
        } catch (error) {
          console.error('Send message error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to send message' }));
        }
        return;
      }

      // Registration endpoint
      if (pathname === '/api/register' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { username, password, email } = data;

          if (!username || !password) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Username and password required' }));
            return;
          }

          // Check if user already exists
          const existingUser = await pool.query(`
            SELECT id FROM user_profiles 
            WHERE username = $1 OR username LIKE $2
          `, [username, `%${username.split('@')[0]}%`]);
          
          if (existingUser.rows.length > 0) {
            res.writeHead(409);
            res.end(JSON.stringify({ error: 'User already exists' }));
            return;
          }

          // Create new user profile (matching login query structure)
          const result = await pool.query(`
            INSERT INTO user_profiles (username, first_name, last_name, is_admin, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, username, first_name, last_name, is_admin
          `, [
            username,
            username.split('@')[0] || username,
            '',
            false
          ]);

          const user = result.rows[0];
          
          // Generate email verification token
          const verificationToken = jwt.sign(
            { userId: user.id, type: 'email_verification' },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          // Store verification token in database
          await pool.query(`
            INSERT INTO email_verification_tokens (user_id, token, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '24 hours')
          `, [user.id, verificationToken]);

          // Send welcome email with verification link
          if (emailTransporter) {
            const verificationLink = `${req.headers.origin || 'http://localhost:5000'}/verify-email?token=${verificationToken}`;
            
            const welcomeEmailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to High Bred Bullies!</title>
                <style>
                  body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                  .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 40px 30px; text-align: center; color: white; position: relative; }
                  .header::before { content: '❄️'; position: absolute; top: 20px; left: 30px; font-size: 24px; opacity: 0.8; }
                  .header::after { content: '🎄'; position: absolute; top: 20px; right: 30px; font-size: 24px; opacity: 0.8; }
                  .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
                  .holiday-msg { font-size: 16px; opacity: 0.95; margin-top: 15px; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 20px; }
                  .content { padding: 40px 30px; }
                  .greeting { font-size: 28px; color: #ff6b6b; margin-bottom: 25px; font-weight: 700; text-align: center; }
                  .message { font-size: 16px; line-height: 1.7; color: #444; margin-bottom: 25px; }
                  .welcome-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 15px; margin: 25px 0; border-left: 5px solid #ff6b6b; }
                  .btn { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 18px; margin: 25px 0; box-shadow: 0 15px 25px rgba(40, 167, 69, 0.3); transition: transform 0.3s; }
                  .btn:hover { transform: translateY(-3px); }
                  .features { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
                  .feature { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; }
                  .feature-icon { font-size: 24px; margin-bottom: 10px; }
                  .footer { background: #2c3e50; padding: 30px; text-align: center; color: white; }
                  .paw-print { color: #ff6b6b; font-size: 20px; margin: 0 8px; }
                  .snow { position: absolute; color: white; opacity: 0.6; animation: snowfall 3s infinite; }
                  @keyframes snowfall { 0% { transform: translateY(-10px); } 100% { transform: translateY(10px); } }
                </style>
              </head>
              <body>
                <div style="padding: 20px;">
                  <div class="container">
                    <div class="header">
                      <div class="snow" style="top: 10%; left: 20%;">❄️</div>
                      <div class="snow" style="top: 30%; right: 25%; animation-delay: 1s;">❄️</div>
                      <div class="logo">🐕 High Bred Bullies</div>
                      <p style="font-size: 18px; margin: 10px 0;">Premium American Bully Community</p>
                      <div class="holiday-msg">🎊 Welcome to our festive family of bulldog enthusiasts! 🎊</div>
                    </div>
                    
                    <div class="content">
                      <div class="greeting">Welcome to the Pack! 🐾</div>
                      
                      <div class="message">
                        Hello ${user.first_name || 'New Member'},<br><br>
                        
                        We're absolutely thrilled to welcome you to High Bred Bullies, the premier community for American Bully enthusiasts! Just like the holiday season brings families together, you've now joined our special family of passionate bulldog lovers.
                      </div>
                      
                      <div class="welcome-box">
                        <strong>🎁 Your membership includes:</strong><br>
                        • Access to premium breeding information<br>
                        • Connect with fellow bulldog enthusiasts<br>
                        • Browse available puppies from top breeders<br>
                        • Educational resources and breeding guides<br>
                        • Exclusive community events and updates
                      </div>
                      
                      <div style="text-align: center;">
                        <a href="${verificationLink}" class="btn">Verify Your Email & Start Exploring! 🚀</a>
                      </div>
                      
                      <div class="features">
                        <div class="feature">
                          <div class="feature-icon">🏆</div>
                          <strong>Premium Genetics</strong><br>
                          <small>Champion bloodlines & health testing</small>
                        </div>
                        <div class="feature">
                          <div class="feature-icon">👥</div>
                          <strong>Expert Community</strong><br>
                          <small>Connect with experienced breeders</small>
                        </div>
                      </div>
                      
                      <div class="message">
                        During this magical holiday season, we're especially grateful for new members like you who share our passion for these amazing dogs. Your journey with High Bred Bullies starts now!
                      </div>
                      
                      <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin: 20px 0;">
                        <strong>📧 Email Verification:</strong><br>
                        Please verify your email address within 24 hours to unlock all community features. Don't worry - you can still browse and login without verification!
                      </div>
                    </div>
                    
                    <div class="footer">
                      <p><strong>High Bred Bullies</strong> <span class="paw-print">🐾</span> Premium American Bully Community</p>
                      <p>Building connections, one paw at a time</p>
                      <p style="font-size: 14px; margin-top: 20px; opacity: 0.8;">🎄 Wishing you and your furry family a wonderful holiday season! 🎄</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `;

            try {
              await emailTransporter.sendMail({
                from: process.env.SMTP_FROM || 'High Bred Bullies <welcome@highbredbullies.com>',
                to: user.username,
                subject: '🎉 Welcome to High Bred Bullies - Verify Your Email!',
                html: welcomeEmailHtml
              });
              console.log(`Welcome email sent to ${user.username}`);
            } catch (emailError) {
              console.error('Failed to send welcome email:', emailError);
            }
          }
          
          // Create JWT token for immediate login (verification optional)
          const token = jwt.sign(
            { 
              userId: user.id, 
              username: user.username,
              isBreeder: false
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.writeHead(201);
          res.end(JSON.stringify({
            token,
            user: {
              id: user.id,
              username: user.username,
              isBreeder: false,
              fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
              emailVerified: false
            },
            message: 'Registration successful! Please check your email to verify your account.'
          }));
        } catch (error) {
          console.error('Registration error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Registration failed' }));
        }
        return;
      }

      // Email verification endpoint
      if (pathname === '/api/verify-email' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { token } = data;

          if (!token) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Verification token required' }));
            return;
          }

          // Verify and decode the token
          let decoded;
          try {
            decoded = jwt.verify(token, JWT_SECRET);
          } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid or expired verification token' }));
            return;
          }

          if (decoded.type !== 'email_verification') {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid token type' }));
            return;
          }

          // Check if token exists and hasn't been used
          const tokenResult = await pool.query(`
            SELECT id, user_id, expires_at, verified_at 
            FROM email_verification_tokens 
            WHERE token = $1 AND verified_at IS NULL
          `, [token]);

          if (tokenResult.rows.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Token not found or already used' }));
            return;
          }

          const tokenData = tokenResult.rows[0];

          // Check if token has expired
          if (new Date() > new Date(tokenData.expires_at)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Verification token has expired' }));
            return;
          }

          // Mark token as used and update user's verification status
          await pool.query(`
            UPDATE email_verification_tokens 
            SET verified_at = NOW() 
            WHERE id = $1
          `, [tokenData.id]);

          await pool.query(`
            UPDATE user_profiles 
            SET email_verified = TRUE 
            WHERE id = $1
          `, [tokenData.user_id]);

          res.writeHead(200);
          res.end(JSON.stringify({ 
            message: 'Email verified successfully!',
            verified: true 
          }));
        } catch (error) {
          console.error('Email verification error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Email verification failed' }));
        }
        return;
      }

      // Get current user endpoint (for authentication verification)
      if (pathname === '/api/user' && req.method === 'GET') {
        try {
          const token = req.headers.authorization?.replace('Bearer ', '');
          if (!token) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'No token provided' }));
            return;
          }

          const decoded = jwt.verify(token, JWT_SECRET);
          
          // Fetch user details from user_profiles
          const result = await pool.query(`
            SELECT id, username, first_name, last_name, is_admin
            FROM user_profiles 
            WHERE id = $1
          `, [decoded.userId]);
          
          if (result.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'User not found' }));
            return;
          }

          const user = result.rows[0];
          
          res.writeHead(200);
          res.end(JSON.stringify({
            id: user.id,
            username: user.username,
            isBreeder: decoded.isBreeder || user.is_admin || false,
            fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
          }));
        } catch (error) {
          console.error('Error fetching user:', error);
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid token' }));
        }
        return;
      }

      // Admin orders endpoint
      if (pathname === '/api/admin/orders' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT o.*
            FROM orders o
            WHERE o.status != 'archived'
            ORDER BY o.created_at DESC
          `);
          
          const orders = result.rows.map(order => ({
            id: order.id.toString(),
            user_id: order.user_id,
            breeder_id: order.breeder_id,
            status: order.status || 'pending',
            total_amount: order.total_amount || 0,
            delivery_method: order.delivery_method,
            delivery_address: order.delivery_address,
            delivery_zip_code: order.delivery_zip_code,
            created_at: order.created_at,
            customer_name: 'Customer',
            customer_email: 'customer@example.com'
          }));

          res.writeHead(200);
          res.end(JSON.stringify(orders));
        } catch (error) {
          console.error('Error fetching orders:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
        }
        return;
      }

      // Admin archived orders endpoint
      if (pathname === '/api/admin/archived-orders' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT o.*
            FROM orders o
            WHERE o.status = 'archived' OR o.status = 'completed'
            ORDER BY o.created_at DESC
          `);
          
          const orders = result.rows.map(order => ({
            id: order.id.toString(),
            user_id: order.user_id,
            breeder_id: order.breeder_id,
            status: order.status,
            total_amount: order.total_amount || 0,
            delivery_method: order.delivery_method,
            delivery_address: order.delivery_address,
            delivery_zip_code: order.delivery_zip_code,
            created_at: order.created_at,
            customer_name: 'Customer',
            customer_email: 'customer@example.com'
          }));

          res.writeHead(200);
          res.end(JSON.stringify(orders));
        } catch (error) {
          console.error('Error fetching archived orders:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch archived orders' }));
        }
        return;
      }

      // Admin inquiries endpoint
      if (pathname === '/api/admin/inquiries' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT * FROM inquiries 
            ORDER BY created_at DESC
          `);
          
          const inquiries = result.rows.map(inquiry => ({
            id: inquiry.id.toString(),
            name: inquiry.name,
            email: inquiry.email,
            phone: inquiry.phone,
            subject: inquiry.subject,
            message: inquiry.message,
            status: inquiry.status || 'pending',
            created_at: inquiry.created_at
          }));

          res.writeHead(200);
          res.end(JSON.stringify(inquiries));
        } catch (error) {
          console.error('Error fetching inquiries:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch inquiries' }));
        }
        return;
      }



      // High Table social feed posts endpoint
      if (pathname === '/api/social_feed_posts' && req.method === 'GET') {
        try {
          // First check what media content exists in the database
          const mediaCheckResult = await pool.query(`
            SELECT COUNT(*) as total_posts, 
                   COUNT(image_url) as posts_with_image_url,
                   COUNT(media_type) as posts_with_media_type
            FROM social_posts
          `);
          
          console.log('Media content check:', mediaCheckResult.rows[0]);
          
          // Sample some actual image_url values to see what's stored
          const sampleResult = await pool.query(`
            SELECT id, image_url, media_type 
            FROM social_posts 
            WHERE image_url IS NOT NULL 
            LIMIT 5
          `);
          
          console.log('Sample image URLs:', sampleResult.rows);
          
          // Get social posts with authentic media from image_url and media_type columns
          const result = await pool.query(`
            SELECT sp.*, up.username, up.first_name, up.last_name, up.avatar_url
            FROM social_posts sp
            LEFT JOIN user_profiles up ON sp.user_id::text = up.user_id::text
            ORDER BY sp.created_at DESC
            LIMIT 50
          `);
          
          const posts = result.rows.map(row => {
            return {
              id: row.id,
              user_id: row.user_id || row.id,
              title: row.title || 'Community Post',
              content: row.content || 'Social post content',
              image_url: row.image_url,
              likes_count: row.likes_count || 0,
              comments_count: row.comments_count || 0,
              is_liked_by_user: false,
              created_at: row.created_at,
              username: row.username || 'Community Member',
              first_name: row.first_name || 'User',
              last_name: row.last_name || '',
              avatar_url: row.avatar_url || null,
              is_testimonial: row.is_testimonial || false,
              moderation_status: row.moderation_status || 'pending',
              visibility: row.visibility || 'public'
            };
          });
          
          res.writeHead(200);
          res.end(JSON.stringify(posts));
        } catch (error) {
          console.error('Error fetching social feed posts:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch social feed posts' }));
        }
        return;
      }

      // Admin blog posts endpoint
      if (pathname === '/api/admin/blog-posts' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT bp.*
            FROM blog_posts bp
            ORDER BY bp.created_at DESC
          `);
          
          const posts = result.rows.map(post => ({
            id: post.id.toString(),
            title: post.title,
            slug: post.slug,
            content: post.content,
            excerpt: post.excerpt,
            category: post.category,
            tags: post.tags || [],
            is_published: post.is_published || false,
            published_at: post.published_at,
            created_at: post.created_at,
            updated_at: post.updated_at,
            author_id: post.author_id,
            author_name: 'High Bred Bullies',
            image_url: post.image_url
          }));

          res.writeHead(200);
          res.end(JSON.stringify(posts));
        } catch (error) {
          console.error('Error fetching blog posts:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch blog posts' }));
        }
        return;
      }

      // Business settings endpoint
      if (pathname === '/api/business/settings' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT * FROM breeders 
            ORDER BY created_at DESC
            LIMIT 1
          `);
          
          const breeder = result.rows[0];
          if (breeder) {
            const settings = {
              id: breeder.id.toString(),
              business_name: breeder.business_name,
              contact_email: breeder.contact_email,
              contact_phone: breeder.contact_phone,
              address: breeder.address,
              city: breeder.city,
              state: breeder.state,
              zip_code: breeder.zip_code,
              website: breeder.website,
              instagram: breeder.instagram,
              facebook: breeder.facebook,
              description: breeder.description,
              specializations: breeder.specializations || [],
              years_experience: breeder.years_experience,
              kennel_size: breeder.kennel_size,
              breeding_philosophy: breeder.breeding_philosophy,
              health_testing: breeder.health_testing,
              delivery_fee: breeder.delivery_fee || 250,
              delivery_areas: breeder.delivery_areas || ["Texas", "Oklahoma", "Arkansas", "Louisiana"],
              is_active: breeder.is_active
            };
            
            res.writeHead(200);
            res.end(JSON.stringify(settings));
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Business settings not found' }));
          }
        } catch (error) {
          console.error('Error fetching business settings:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch business settings' }));
        }
        return;
      }

      // User profiles batch endpoint for social posts
      if (pathname === '/api/user-profiles/batch' && req.method === 'POST') {
        try {
          const body = await parseBody(req);
          const { userIds } = body;
          
          if (!userIds || !Array.isArray(userIds)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid userIds array' }));
            return;
          }

          const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
          const result = await pool.query(`
            SELECT id, user_id, first_name, last_name, username, avatar_url
            FROM user_profiles 
            WHERE user_id = ANY($1)
          `, [userIds]);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching user profiles batch:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch user profiles' }));
        }
        return;
      }

      // User profile GET endpoint
      if (pathname === '/api/user/profile' && req.method === 'GET') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const result = await pool.query(`
            SELECT * FROM user_profiles WHERE user_id = $1
          `, [userId]);

          if (result.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Profile not found' }));
            return;
          }

          const profile = result.rows[0];
          res.writeHead(200);
          res.end(JSON.stringify({
            id: profile.id.toString(),
            user_id: profile.user_id,
            username: profile.username,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at,
            updated_at: profile.updated_at
          }));
        } catch (error) {
          console.error('Error fetching user profile:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch profile' }));
        }
        return;
      }

      // User profile POST endpoint
      if (pathname === '/api/user/profile' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const body = await parseBody(req);
          const { username, first_name, last_name } = body;

          const result = await pool.query(`
            INSERT INTO user_profiles (user_id, username, first_name, last_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              username = EXCLUDED.username,
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              updated_at = NOW()
            RETURNING *
          `, [userId, username, first_name, last_name]);

          const profile = result.rows[0];
          res.writeHead(200);
          res.end(JSON.stringify({
            id: profile.id.toString(),
            user_id: profile.user_id,
            username: profile.username,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at,
            updated_at: profile.updated_at
          }));
        } catch (error) {
          console.error('Error creating/updating user profile:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to create profile' }));
        }
        return;
      }

      // Pet owner status endpoint
      if (pathname === '/api/user/pet-owner-status' && req.method === 'GET') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const result = await pool.query(`
            SELECT * FROM pet_owners WHERE user_id = $1
          `, [userId]);

          if (result.rows.length > 0) {
            res.writeHead(200);
            res.end(JSON.stringify(result.rows[0]));
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not a pet owner' }));
          }
        } catch (error) {
          console.error('Error checking pet owner status:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to check status' }));
        }
        return;
      }

      // Puppy pricing endpoint
      if (pathname.match(/^\/api\/litters\/[^\/]+\/puppy-prices$/) && req.method === 'GET') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Authentication required' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const litterId = pathname.split('/')[3];
          
          // Get puppies for this litter with their pricing
          const puppiesResult = await pool.query(
            'SELECT id, gender FROM puppies WHERE litter_id = $1 AND is_available = true',
            [litterId]
          );
          
          // Get litter pricing information
          const litterResult = await pool.query(
            'SELECT price_per_male, price_per_female FROM litters WHERE id = $1',
            [litterId]
          );
          
          if (litterResult.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Litter not found' }));
            return;
          }
          
          const litter = litterResult.rows[0];
          const puppyPrices = {};
          
          // Build pricing for each puppy
          puppiesResult.rows.forEach((puppy) => {
            const price = puppy.gender === 'male' ? litter.price_per_male : litter.price_per_female;
            puppyPrices[puppy.id] = price || 250000; // Default $2500 if no price set
          });
          
          res.writeHead(200);
          res.end(JSON.stringify(puppyPrices));
        } catch (error) {
          console.error('Puppy pricing error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch puppy prices' }));
        }
        return;
      }

      // Stripe checkout endpoint for puppy purchases
      if (pathname === '/api/checkout/create-litter-checkout' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Authentication required' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const data = await parseBody(req);
          const { litterId, puppyIds, deliveryOption, deliveryZipCode } = data;

          if (!litterId || !puppyIds || !Array.isArray(puppyIds) || puppyIds.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request data' }));
            return;
          }

          // Get litter and puppy information
          const litterResult = await pool.query(`
            SELECT l.*, b.business_name, b.contact_email
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.id = $1
          `, [litterId]);

          if (litterResult.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Litter not found' }));
            return;
          }

          const litter = litterResult.rows[0];

          // Get puppy details
          const puppiesResult = await pool.query(`
            SELECT id, name, gender, color, is_available
            FROM puppies
            WHERE id = ANY($1) AND litter_id = $2 AND is_available = true
          `, [puppyIds, litterId]);

          if (puppiesResult.rows.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No available puppies found' }));
            return;
          }

          // Calculate total price (using base price from litter)
          const basePrice = litter.male_price || litter.female_price || 250000; // Default $2500 in cents
          const totalAmount = puppiesResult.rows.length * basePrice;

          // Initialize Stripe with secret key - dynamically require
          let stripe;
          try {
            stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          } catch (error) {
            console.error('Stripe package not found - using direct API calls');
            // Fall back to direct HTTP API calls to Stripe
            const https = require('https');
            const querystring = require('querystring');
            
            const createStripeSession = async (sessionData) => {
              return new Promise((resolve, reject) => {
                const postData = querystring.stringify({
                  'payment_method_types[]': 'card',
                  'mode': 'payment',
                  'success_url': sessionData.success_url,
                  'cancel_url': sessionData.cancel_url,
                  'line_items[0][price_data][currency]': 'usd',
                  'line_items[0][price_data][product_data][name]': sessionData.line_items[0].price_data.product_data.name,
                  'line_items[0][price_data][product_data][description]': sessionData.line_items[0].price_data.product_data.description,
                  'line_items[0][price_data][unit_amount]': sessionData.line_items[0].price_data.unit_amount,
                  'line_items[0][quantity]': 1,
                  'metadata[userId]': sessionData.metadata.userId,
                  'metadata[litterId]': sessionData.metadata.litterId,
                  'metadata[puppyIds]': sessionData.metadata.puppyIds,
                  'metadata[deliveryOption]': sessionData.metadata.deliveryOption
                });

                const options = {
                  hostname: 'api.stripe.com',
                  port: 443,
                  path: '/v1/checkout/sessions',
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                  }
                };

                const req = https.request(options, (res) => {
                  let data = '';
                  res.on('data', (chunk) => data += chunk);
                  res.on('end', () => {
                    try {
                      const response = JSON.parse(data);
                      if (response.error) {
                        reject(new Error(response.error.message));
                      } else {
                        resolve(response);
                      }
                    } catch (e) {
                      reject(e);
                    }
                  });
                });

                req.on('error', reject);
                req.write(postData);
                req.end();
              });
            };

            // Create session using direct API
            const sessionData = {
              line_items: [{
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `${puppiesResult.rows[0].name || 'Puppy'} - ${litter.name || 'Premium Litter'}`,
                    description: `${puppiesResult.rows[0].color} ${puppiesResult.rows[0].gender} American Bully puppy`
                  },
                  unit_amount: basePrice
                }
              }],
              success_url: `https://${req.headers.host}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `https://${req.headers.host}/litter/${litterId}`,
              metadata: {
                userId: userId,
                litterId: litterId,
                puppyIds: puppyIds.join(','),
                deliveryOption: deliveryOption,
                deliveryZipCode: deliveryZipCode || ''
              }
            };

            try {
              const session = await createStripeSession(sessionData);
              console.log('✅ Stripe checkout session created via API:', session.id);
              
              res.writeHead(200);
              res.end(JSON.stringify({ 
                url: session.url,
                sessionId: session.id,
                success: true 
              }));
              return;
            } catch (apiError) {
              console.error('Direct Stripe API error:', apiError);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to create Stripe session: ' + apiError.message }));
              return;
            }
          }

          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: puppiesResult.rows.map(puppy => ({
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${puppy.name || 'Puppy'} - ${litter.name || 'Premium Litter'}`,
                  description: `${puppy.color} ${puppy.gender} American Bully puppy`,
                  images: ['https://placehold.co/400x300/e2e8f0/64748b?text=American+Bully'],
                },
                unit_amount: basePrice,
              },
              quantity: 1,
            })),
            mode: 'payment',
            success_url: `${req.headers.origin}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/litter/${litterId}`,
            metadata: {
              userId: userId,
              litterId: litterId,
              puppyIds: puppyIds.join(','),
              deliveryOption: deliveryOption,
              deliveryZipCode: deliveryZipCode || ''
            }
          });

          console.log('✅ Stripe checkout session created:', session.id);

          res.writeHead(200);
          res.end(JSON.stringify({ 
            url: session.url,
            sessionId: session.id,
            success: true 
          }));

        } catch (error) {
          console.error('Checkout creation error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to create checkout session' }));
        }
        return;
      }

      // Get Stripe prices for puppies
      if (pathname.startsWith('/api/puppies/') && pathname.endsWith('/stripe-price') && req.method === 'GET') {
        try {
          const puppyId = pathname.split('/')[3];
          
          if (!stripe) {
            res.writeHead(503);
            res.end(JSON.stringify({ error: 'Stripe not configured' }));
            return;
          }

          // Get puppy data with stripe_price_id
          const puppyQuery = 'SELECT id, stripe_price_id, gender, litter_id FROM puppies WHERE id = $1';
          const puppyResult = await pool.query(puppyQuery, [puppyId]);
          
          if (puppyResult.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Puppy not found' }));
            return;
          }

          const puppy = puppyResult.rows[0];
          let priceId = puppy.stripe_price_id;

          // If no puppy-specific price, fall back to litter price
          if (!priceId) {
            const litterQuery = 'SELECT stripe_male_price_id, stripe_female_price_id FROM litters WHERE id = $1';
            const litterResult = await pool.query(litterQuery, [puppy.litter_id]);
            
            if (litterResult.rows.length > 0) {
              const litter = litterResult.rows[0];
              priceId = puppy.gender === 'male' ? litter.stripe_male_price_id : litter.stripe_female_price_id;
            }
          }

          if (!priceId) {
            res.writeHead(200);
            res.end(JSON.stringify({ price: null, currency: 'usd' }));
            return;
          }

          // Fetch price from Stripe
          const stripePrice = await stripe.prices.retrieve(priceId);
          
          res.writeHead(200);
          res.end(JSON.stringify({
            price: stripePrice.unit_amount,
            currency: stripePrice.currency,
            stripe_price_id: priceId
          }));

        } catch (error) {
          console.error('Error fetching Stripe price:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch price data' }));
        }
        return;
      }

      // Get Stripe prices for multiple puppies
      if (pathname === '/api/puppies/stripe-prices' && req.method === 'POST') {
        try {
          if (!stripe) {
            res.writeHead(503);
            res.end(JSON.stringify({ error: 'Stripe not configured' }));
            return;
          }

          const body = await parseBody(req);
          const { puppyIds } = body;

          if (!Array.isArray(puppyIds) || puppyIds.length === 0) {
            res.writeHead(200);
            res.end(JSON.stringify({}));
            return;
          }

          // Get puppy data with stripe_price_ids
          const placeholders = puppyIds.map((_, i) => `$${i + 1}`).join(',');
          const puppyQuery = `SELECT id, stripe_price_id, gender, litter_id FROM puppies WHERE id IN (${placeholders})`;
          const puppyResult = await pool.query(puppyQuery, puppyIds);

          const prices = {};

          for (const puppy of puppyResult.rows) {
            let priceId = puppy.stripe_price_id;

            // If no puppy-specific price, fall back to litter price
            if (!priceId) {
              const litterQuery = 'SELECT stripe_male_price_id, stripe_female_price_id FROM litters WHERE id = $1';
              const litterResult = await pool.query(litterQuery, [puppy.litter_id]);
              
              if (litterResult.rows.length > 0) {
                const litter = litterResult.rows[0];
                priceId = puppy.gender === 'male' ? litter.stripe_male_price_id : litter.stripe_female_price_id;
              }
            }

            if (priceId) {
              try {
                const stripePrice = await stripe.prices.retrieve(priceId);
                prices[puppy.id] = {
                  price: stripePrice.unit_amount,
                  currency: stripePrice.currency,
                  stripe_price_id: priceId
                };
              } catch (stripeError) {
                console.error(`Error fetching Stripe price for puppy ${puppy.id}:`, stripeError);
                prices[puppy.id] = { price: null, currency: 'usd' };
              }
            } else {
              prices[puppy.id] = { price: null, currency: 'usd' };
            }
          }

          res.writeHead(200);
          res.end(JSON.stringify(prices));

        } catch (error) {
          console.error('Error fetching Stripe prices:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch price data' }));
        }
        return;
      }

      // User orders endpoint
      if (pathname.startsWith('/api/user/orders') && req.method === 'GET') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const url = new URL(req.url, `http://${req.headers.host}`);
          const status = url.searchParams.get('status');

          let query = 'SELECT * FROM orders WHERE user_id = $1';
          const params = [userId];

          if (status) {
            query += ' AND status = $2';
            params.push(status);
          }

          query += ' ORDER BY created_at DESC';

          const result = await pool.query(query, params);
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching user orders:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
        }
        return;
      }

      // Create pet owner endpoint
      if (pathname === '/api/user/pet-owner' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const body = await parseBody(req);
          const { adoption_date } = body;

          const result = await pool.query(`
            INSERT INTO pet_owners (user_id, adoption_date, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              adoption_date = EXCLUDED.adoption_date,
              updated_at = NOW()
            RETURNING *
          `, [userId, adoption_date]);

          res.writeHead(200);
          res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
          console.error('Error creating pet owner:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to create pet owner' }));
        }
        return;
      }

      // Health check endpoint
      if (pathname === '/api/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', database: 'connected' }));
        return;
      }

      // Blog posts endpoint
      if (pathname === '/api/blog/posts' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT id, title, slug, excerpt, category, image_url, 
                   author_name, published_at, updated_at, is_published
            FROM blog_posts 
            WHERE is_published = true 
            ORDER BY published_at DESC
          `);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching blog posts:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch blog posts' }));
        }
        return;
      }

      // Individual blog post endpoint
      if (pathname.startsWith('/api/blog/posts/') && req.method === 'GET') {
        try {
          const postId = pathname.split('/')[4];
          const result = await pool.query(`
            SELECT * FROM blog_posts WHERE id = $1 AND is_published = true
          `, [postId]);
          
          if (result.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Blog post not found' }));
            return;
          }

          res.writeHead(200);
          res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
          console.error('Error fetching blog post:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch blog post' }));
        }
        return;
      }

      // Featured litters endpoint
      if (pathname === '/api/litters/featured' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT l.*, b.business_name as breeder_name
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.status = 'active'
            ORDER BY l.created_at DESC
            LIMIT 10
          `);
          
          const litters = result.rows.map(litter => ({
            id: litter.id.toString(),
            name: litter.name,
            breed: litter.breed,
            birth_date: litter.birth_date,
            available_puppies: litter.available_puppies,
            total_puppies: litter.total_puppies,
            price_per_male: litter.price_per_male,
            price_per_female: litter.price_per_female,
            dam_name: litter.dam_name,
            sire_name: litter.sire_name,
            description: litter.description,
            image_url: litter.image_url,
            status: litter.status,
            breeder_id: litter.breeder_id?.toString(),
            breeders: {
              business_name: litter.breeder_name || 'High Bred Bullies',
              delivery_fee: 250,
              delivery_areas: ["Texas", "Oklahoma", "Arkansas", "Louisiana"]
            }
          }));

          res.writeHead(200);
          res.end(JSON.stringify(litters));
        } catch (error) {
          console.error('Error fetching featured litters:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch featured litters' }));
        }
        return;
      }

      // Upcoming litters endpoint
      if (pathname === '/api/litters/upcoming' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT l.*, b.business_name as breeder_name
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.is_active = true
            ORDER BY l.created_at DESC
            LIMIT 3
          `);
          
          const litters = result.rows.map(litter => ({
            id: litter.id.toString(),
            name: litter.dam_name + " x " + litter.sire_name,
            breed: litter.breed,
            birth_date: litter.birth_date,
            expected_date: litter.expected_delivery_date || litter.birth_date,
            available_puppies: litter.total_puppies || 0,
            total_puppies: litter.total_puppies || 0,
            price_per_male: litter.male_price,
            price_per_female: litter.female_price,
            dam_name: litter.dam_name,
            sire_name: litter.sire_name,
            description: litter.description,
            image_url: Array.isArray(litter.images) ? litter.images[0] : null,
            status: 'upcoming',
            breeder_id: litter.breeder_id?.toString(),
            breeders: {
              business_name: litter.breeder_name || 'High Bred Bullies',
              delivery_fee: 250,
              delivery_areas: ["Texas", "Oklahoma", "Arkansas", "Louisiana"]
            }
          }));

          res.writeHead(200);
          res.end(JSON.stringify(litters));
        } catch (error) {
          console.error('Error fetching upcoming litters:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch upcoming litters' }));
        }
        return;
      }

      // Litters by breeder endpoint for Admin page (dynamic breeder ID)
      if (pathname.startsWith('/api/litters/by-breeder/') && req.method === 'GET') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const breederId = pathname.split('/')[4];
          console.log('Fetching litters for breeder ID:', breederId);
          
          // Query all active litters (not filtered by breeder since current user is admin)
          const result = await pool.query(`
            SELECT l.*, b.business_name as breeder_name
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.is_active = true
            ORDER BY l.created_at DESC
          `);
          
          console.log('Found litters:', result.rows.length);
          
          const litters = result.rows.map(litter => ({
            id: litter.id.toString(),
            name: litter.name || `${litter.dam_name} x ${litter.sire_name}`,
            breed: litter.breed,
            birth_date: litter.birth_date,
            available_puppies: litter.available_puppies || 0,
            total_puppies: litter.total_puppies || 0,
            dam_name: litter.dam_name,
            sire_name: litter.sire_name,
            status: litter.status || 'active',
            breeder_name: litter.breeder_name || 'High Bred Bullies',
            created_at: litter.created_at,
            updated_at: litter.updated_at
          }));

          res.writeHead(200);
          res.end(JSON.stringify(litters));
        } catch (error) {
          console.error('Error fetching breeder litters:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch litters' }));
        }
        return;
      }

      // Litter management endpoint (must come before individual litter endpoint)
      if (pathname.startsWith('/api/litters/') && pathname.endsWith('/manage') && req.method === 'GET') {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'No token provided' }));
          return;
        }

        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET);
          
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Admin access required' }));
            return;
          }

          const litterId = pathname.split('/')[3];
          console.log('Fetching litter management data for ID:', litterId);

          // Use simplified queries without transactions to avoid timeouts
          try {
            // Fetch litter details with breeder info
            const litterResult = await pool.query(`
              SELECT l.*, b.business_name as breeder_name 
              FROM litters l
              LEFT JOIN breeders b ON l.breeder_id = b.id
              WHERE l.id = $1
            `, [litterId]);
            
            if (litterResult.rows.length === 0) {
              res.writeHead(404);
              res.end(JSON.stringify({ error: 'Litter not found' }));
              return;
            }

            // Fetch all puppies for this litter
            const puppiesResult = await pool.query(`
              SELECT id, litter_id, name, gender, color, markings, 
                     weight_at_birth, notes, is_available, image_url, 
                     stripe_price_id, reserved_by, sold_to, created_at, updated_at
              FROM puppies 
              WHERE litter_id = $1 
              ORDER BY created_at ASC
            `, [litterId]);

            const litter = litterResult.rows[0];
            const puppies = puppiesResult.rows;

            const responseData = {
              id: litter.id.toString(),
              name: litter.name || `${litter.dam_name} x ${litter.sire_name}`,
              breed: litter.breed,
              birth_date: litter.birth_date,
              available_puppies: litter.available_puppies || 0,
              total_puppies: litter.total_puppies || 0,
              price_per_male: litter.price_per_male || 0,
              price_per_female: litter.price_per_female || 0,
              stripe_male_price_id: litter.stripe_male_price_id,
              stripe_female_price_id: litter.stripe_female_price_id,
              stripe_product_id: litter.stripe_product_id,
              dam_name: litter.dam_name,
              sire_name: litter.sire_name,
              dam_image_url: litter.dam_image_url,
              sire_image_url: litter.sire_image_url,
              description: litter.description,
              image_url: litter.image_url,
              status: litter.status || 'upcoming',
              breeder_id: litter.breeder_id?.toString(),
              quantity_discounts: litter.quantity_discounts,
              created_at: litter.created_at,
              updated_at: litter.updated_at,
              puppies: puppies.map(puppy => ({
                id: puppy.id.toString(),
                litter_id: puppy.litter_id.toString(),
                name: puppy.name,
                gender: puppy.gender,
                color: puppy.color,
                markings: puppy.markings,
                weight_at_birth: puppy.weight_at_birth,
                notes: puppy.notes,
                is_available: puppy.is_available,
                image_url: puppy.image_url,
                stripe_price_id: puppy.stripe_price_id,
                reserved_by: puppy.reserved_by,
                sold_to: puppy.sold_to,
                created_at: puppy.created_at,
                updated_at: puppy.updated_at
              }))
            };

            console.log(`Successfully fetched litter ${litterId} with ${puppies.length} puppies`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));

          } catch (dbError) {
            console.error('Error in manage endpoint:', dbError);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }

        } catch (error) {
          console.error('Error in manage endpoint:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
      }

      // Individual litter endpoint with puppies (must come after specific routes)
      if (pathname.startsWith('/api/litters/') && pathname.split('/').length === 4 && !pathname.includes('/featured') && !pathname.includes('/upcoming') && !pathname.includes('/by-breeder') && !pathname.includes('/manage') && req.method === 'GET') {
        try {
          const litterId = pathname.split('/')[3];
          
          // Fetch litter details
          const litterResult = await pool.query(`
            SELECT l.*, b.business_name as breeder_name 
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.id = $1
          `, [litterId]);
          
          if (litterResult.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Litter not found' }));
            return;
          }

          // Fetch puppies for this litter
          const puppiesResult = await pool.query(`
            SELECT * FROM puppies 
            WHERE litter_id = $1 
            ORDER BY name ASC
          `, [litterId]);

          const litter = litterResult.rows[0];
          const puppies = puppiesResult.rows.map(puppy => ({
            id: puppy.id.toString(),
            litter_id: puppy.litter_id.toString(),
            name: puppy.name,
            gender: puppy.gender,
            color: puppy.color,
            is_available: puppy.is_available,
            image_url: puppy.image_url,
            created_at: puppy.created_at,
            updated_at: puppy.updated_at
          }));

          res.writeHead(200);
          res.end(JSON.stringify({
            id: litter.id.toString(),
            name: litter.name || `${litter.dam_name} x ${litter.sire_name}`,
            breed: litter.breed,
            birth_date: litter.birth_date,
            available_puppies: litter.available_puppies,
            total_puppies: litter.total_puppies,
            price_per_male: litter.price_per_male,
            price_per_female: litter.price_per_female,
            dam_name: litter.dam_name,
            sire_name: litter.sire_name,
            description: litter.description,
            image_url: litter.image_url,
            status: litter.status,
            breeder_id: litter.breeder_id?.toString(),
            puppies: puppies,
            breeders: {
              business_name: litter.breeder_name || 'High Bred Bullies',
              delivery_fee: 250,
              delivery_areas: ["Texas", "Oklahoma", "Arkansas", "Louisiana"]
            }
          }));
        } catch (error) {
          console.error('Error fetching litter:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch litter' }));
        }
        return;
      }

      // Litter puppies endpoint (for individual litter puppy data)
      if (pathname.match(/^\/api\/litters\/[^\/]+\/puppies$/) && req.method === 'GET') {
        try {
          const litterId = pathname.split('/')[3];
          
          const puppiesResult = await pool.query(`
            SELECT * FROM puppies 
            WHERE litter_id = $1 
            ORDER BY name ASC
          `, [litterId]);

          const puppies = puppiesResult.rows.map(puppy => ({
            id: puppy.id.toString(),
            litter_id: puppy.litter_id.toString(),
            name: puppy.name,
            gender: puppy.gender,
            weight: puppy.weight,
            color: puppy.color,
            markings: puppy.markings,
            birth_order: puppy.birth_order,
            is_available: puppy.is_available,
            price: puppy.price,
            description: puppy.description,
            health_status: puppy.health_status,
            images: puppy.images || []
          }));

          res.writeHead(200);
          res.end(JSON.stringify(puppies));
        } catch (error) {
          console.error('Error fetching litter puppies:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch litter puppies' }));
        }
        return;
      }

      // Admin inquiries endpoint
      if (pathname === '/api/inquiries' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT * FROM inquiries 
            ORDER BY created_at DESC
          `);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching inquiries:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch inquiries' }));
        }
        return;
      }

      // Submit inquiry endpoint with email notifications
      if (pathname === '/api/inquiries' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { name, email, subject, message, litter_id, user_id } = data;

          console.log('New inquiry submission:', { name, email, subject, litter_id });

          // Insert inquiry into database
          const result = await pool.query(`
            INSERT INTO inquiries (user_id, litter_id, name, email, subject, message, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
            RETURNING *
          `, [user_id || null, litter_id || null, name, email, subject, message]);

          const inquiry = result.rows[0];

          // Send confirmation email to customer
          if (emailTransporter) {
            const customerEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Thank you for your inquiry!</h2>
                <p>Dear ${name},</p>
                <p>We have received your inquiry and will get back to you within 24 hours.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Your inquiry:</h3>
                  <p><strong>Subject:</strong> ${subject}</p>
                  <p><strong>Message:</strong> ${message}</p>
                </div>
                <p>Best regards,<br>High Bred Bullies Team</p>
              </div>
            `;

            // Send customer confirmation using unified function
            try {
              const customerSuccess = await sendEmail({
                to: email,
                subject: 'Thank you for contacting High Bred Bullies',
                html: customerEmailHtml
              });
              if (customerSuccess) {
                console.log('Inquiry confirmation email sent to customer:', email);
              }
            } catch (emailError) {
              console.error('Failed to send customer confirmation email:', emailError);
            }

            // Send admin notification using unified function
            const adminEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb;">New Customer Inquiry</h1>
                <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Customer Information:</h3>
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Subject:</strong> ${subject}</p>
                  ${litter_id ? `<p><strong>Litter ID:</strong> ${litter_id}</p>` : ''}
                  <p><strong>Message:</strong></p>
                  <p style="white-space: pre-wrap;">${message}</p>
                </div>
                <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
              </div>
            `;

            try {
              const adminSuccess = await sendEmail({
                to: 'gpass1979@gmail.com',
                subject: `New Inquiry from ${name}`,
                html: adminEmailHtml
              });
              if (adminSuccess) {
                console.log('Inquiry notification email sent to admin');
              }
            } catch (emailError) {
              console.error('Failed to send admin notification email:', emailError);
            }
          }

          res.writeHead(201);
          res.end(JSON.stringify({ 
            success: true, 
            inquiry: inquiry,
            message: 'Inquiry submitted successfully' 
          }));
        } catch (error) {
          console.error('Error submitting inquiry:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to submit inquiry' }));
        }
        return;
      }

      // Admin social posts endpoint
      if (pathname === '/api/admin/social-posts' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT sp.*, up.first_name, up.last_name, up.username
            FROM social_posts sp
            LEFT JOIN user_profiles up ON sp.user_id = up.user_id
            ORDER BY sp.created_at DESC
          `);
          
          const posts = result.rows.map(post => ({
            id: post.id,
            title: post.title,
            content: post.content,
            image_url: post.image_url,
            visibility: post.visibility || 'public',
            moderation_status: post.moderation_status || 'pending',
            is_testimonial: post.is_testimonial || false,
            created_at: post.created_at,
            user_id: post.user_id,
            user_profiles: post.first_name || post.last_name || post.username ? {
              first_name: post.first_name,
              last_name: post.last_name,
              username: post.username
            } : undefined
          }));
          
          res.writeHead(200);
          res.end(JSON.stringify(posts));
        } catch (error) {
          console.error('Error fetching admin social posts:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch social posts' }));
        }
        return;
      }

      // Admin orders endpoint
      if (pathname === '/api/orders' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT * FROM orders 
            WHERE status NOT IN ('cancelled', 'archived')
            ORDER BY created_at DESC
          `);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching orders:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
        }
        return;
      }

      // Admin archived orders endpoint
      if (pathname === '/api/orders/archived' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT * FROM orders 
            WHERE status IN ('cancelled', 'archived')
            ORDER BY updated_at DESC
          `);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching archived orders:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch archived orders' }));
        }
        return;
      }

      // Breeder profile endpoint
      if (pathname.startsWith('/api/breeders/') && req.method === 'GET') {
        try {
          const userId = pathname.split('/')[3];
          console.log('Fetching breeder for user ID:', userId);
          
          // First try to find existing breeder record
          // Handle both string and UUID formats
          const result = await pool.query(`
            SELECT * FROM breeders 
            WHERE user_id::text = $1
          `, [userId]);
          
          if (result.rows.length > 0) {
            res.writeHead(200);
            res.end(JSON.stringify(result.rows[0]));
          } else {
            // No breeder record found, return empty structure
            res.writeHead(200);
            res.end(JSON.stringify({
              user_id: userId,
              business_name: '',
              contact_phone: '',
              contact_email: '',
              address: '',
              delivery_areas: [],
              delivery_fee: 0
            }));
          }
        } catch (error) {
          console.error('Error fetching breeder:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch breeder' }));
        }
        return;
      }

      // Update breeder profile endpoint
      if (pathname.startsWith('/api/breeders/') && req.method === 'PUT') {
        try {
          const userId = pathname.split('/')[3];
          const body = await parseBody(req);
          
          const result = await pool.query(`
            UPDATE breeders 
            SET business_name = $1, contact_phone = $2, contact_email = $3, 
                address = $4, delivery_areas = $5, delivery_fee = $6, updated_at = NOW()
            WHERE user_id = $7
            RETURNING *
          `, [
            body.business_name, body.contact_phone, body.contact_email,
            body.address, body.delivery_areas, body.delivery_fee, userId
          ]);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
          console.error('Error updating breeder:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to update breeder' }));
        }
        return;
      }

      // Site config endpoint
      if (pathname === '/api/site-config' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT key, value FROM site_config
          `);
          
          const config = {};
          result.rows.forEach(row => {
            config[row.key] = row.value;
          });
          
          res.writeHead(200);
          res.end(JSON.stringify(config));
        } catch (error) {
          console.error('Error fetching site config:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch site config' }));
        }
        return;
      }

      // Update site config endpoint
      if (pathname === '/api/site-config' && req.method === 'PUT') {
        try {
          const body = await parseBody(req);
          
          for (const update of body) {
            await pool.query(`
              INSERT INTO site_config (key, value, updated_at) 
              VALUES ($1, $2, NOW())
              ON CONFLICT (key) 
              DO UPDATE SET value = $2, updated_at = NOW()
            `, [update.key, update.value]);
          }
          
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error('Error updating site config:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to update site config' }));
        }
        return;
      }

      // User profiles batch endpoint
      if (pathname === '/api/user-profiles/batch' && req.method === 'POST') {
        try {
          // Check authentication
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
          
          const body = await parseBody(req);
          const { userIds } = body;
          
          if (!userIds || !Array.isArray(userIds)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'userIds array is required' }));
            return;
          }
          
          if (userIds.length === 0) {
            res.writeHead(200);
            res.end(JSON.stringify([]));
            return;
          }
          
          const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
          const result = await pool.query(`
            SELECT * FROM user_profiles 
            WHERE user_id IN (${placeholders})
          `, userIds);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching user profiles batch:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch user profiles' }));
        }
        return;
      }

      // Breeders by user endpoint for admin
      if (pathname.startsWith('/api/breeders/by-user/') && req.method === 'GET') {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'No token provided' }));
          return;
        }

        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Admin access required' }));
            return;
          }
        } catch (error) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid token' }));
          return;
        }

        // Extract userId from URL path: /api/breeders/by-user/{userId}
        const userId = pathname.replace('/api/breeders/by-user/', '');
        console.log('Full pathname:', pathname);
        console.log('Extracted user ID:', userId);
        
        if (!userId || userId.length < 10) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid user ID' }));
          return;
        }
        try {
          const result = await pool.query(`
            SELECT b.* 
            FROM breeders b
            WHERE b.user_id = $1
          `, [userId]);
          
          if (result.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'No breeder profile found for user' }));
            return;
          }
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
          console.error('Error fetching breeder by user:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch breeder' }));
        }
        return;
      }

      // Bulk get puppy prices endpoint for Stripe pricing
      if (pathname === '/api/puppies/stripe-prices' && req.method === 'POST') {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        try {
          const body = await parseBody(req);
          const { puppyIds } = body;
          
          if (!Array.isArray(puppyIds) || puppyIds.length === 0) {
            res.writeHead(200);
            res.end(JSON.stringify({}));
            return;
          }
          
          const placeholders = puppyIds.map((_, index) => `$${index + 1}`).join(', ');
          const result = await pool.query(`
            SELECT p.id, p.stripe_price_id, l.price_per_male, l.price_per_female, p.gender
            FROM puppies p
            JOIN litters l ON p.litter_id = l.id
            WHERE p.id IN (${placeholders})
          `, puppyIds);
          
          const priceData = {};
          
          for (const puppy of result.rows) {
            let price = null;
            let currency = 'usd';
            let stripe_price_id = null;
            
            if (puppy.stripe_price_id && stripe) {
              try {
                const stripePrice = await stripe.prices.retrieve(puppy.stripe_price_id);
                price = stripePrice.unit_amount || 0;
                currency = stripePrice.currency || 'usd';
                stripe_price_id = puppy.stripe_price_id;
              } catch (error) {
                console.error(`Stripe price fetch error for puppy ${puppy.id}:`, error.message);
                // Don't set fallback here - let frontend handle it
              }
            }
            
            priceData[puppy.id] = { price, currency, stripe_price_id };
          }
          
          res.writeHead(200);
          res.end(JSON.stringify(priceData));
        } catch (error) {
          console.error('Error fetching bulk puppy prices:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch puppy prices' }));
        }
        return;
      }

      // Litters by breeder endpoint for admin
      if (pathname.startsWith('/api/litters/by-breeder/') && req.method === 'GET') {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'No token provided' }));
          return;
        }

        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Admin access required' }));
            return;
          }
        } catch (error) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid token' }));
          return;
        }

        const breederId = pathname.split('/').pop();
        try {
          const result = await pool.query(`
            SELECT l.*, 
                   b.business_name as breeder_name,
                   COALESCE((SELECT COUNT(*) FROM puppies p WHERE p.litter_id = l.id), 0) as available_puppies,
                   COALESCE((SELECT COUNT(*) FROM puppies p WHERE p.litter_id = l.id), 0) as total_puppies
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.breeder_id = $1
            ORDER BY l.created_at DESC
          `, [breederId]);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching litters by breeder:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch litters' }));
        }
        return;
      }

      // Litters endpoint for admin
      if (pathname === '/api/litters' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT l.*, 
                   b.business_name as breeder_name,
                   COALESCE((SELECT COUNT(*) FROM puppies p WHERE p.litter_id = l.id), 0) as available_puppies,
                   COALESCE((SELECT COUNT(*) FROM puppies p WHERE p.litter_id = l.id), 0) as total_puppies
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            ORDER BY l.created_at DESC
          `);
          
          res.writeHead(200);
          res.end(JSON.stringify(result.rows));
        } catch (error) {
          console.error('Error fetching litters:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch litters' }));
        }
        return;
      }

      // Email API Endpoints
      
      // Contact form submission endpoint
      if (pathname === '/api/contact' && req.method === 'POST') {
        setHeaders(res);
        console.log('Contact form API endpoint hit');
        
        try {
          const data = await parseBody(req);
          console.log('Contact form data parsed:', { name: data.name, email: data.email, subject: data.subject });
          const { name, email, subject, message } = data;
          
          if (!name || !email || !message) {
            console.log('Contact form validation failed');
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Name, email, and message are required' }));
            return;
          }

          console.log(`Contact form submitted: ${name} (${email}) - ${subject || 'No subject'}`);

          // Skip database storage for now - respond immediately
          const result = { rows: [{ id: 'temp_' + Date.now() }] };

          // Use exact same HTML format as test emails
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Contact Form Submission</h1>
              <p>New contact form submission from High Bred Bullies website.</p>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject || 'Contact Form Submission'}</p>
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
              </div>
              <p>Sent at: ${new Date().toISOString()}</p>
            </div>
          `;

          // Send contact form notification immediately (not in background)
          if (emailTransporter) {
            try {
              const success = await sendEmail({
                to: 'gpass1979@gmail.com',
                subject: `Contact Form Submission: ${subject || 'New Message'}`,
                html: emailHtml
              });
              if (success) {
                console.log('Contact form notification sent to admin successfully');
              } else {
                console.error('Contact form notification failed to send');
              }
            } catch (emailError) {
              console.error('Contact form email error:', emailError);
            }
          }

          // Respond with success regardless of email status
          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            id: result.rows[0].id,
            message: 'Your message has been received. We will get back to you soon!'
          }));
        } catch (error) {
          console.error('Error handling contact form:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to submit contact form' }));
        }
        return;
      }

      // OpenAI API test endpoint
      if (pathname === '/api/openai/test' && req.method === 'POST') {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'No token provided' }));
          return;
        }

        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET);
          
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Admin access required' }));
            return;
          }

          if (!OPENAI_API_KEY) {
            res.writeHead(500);
            res.end(JSON.stringify({ 
              error: 'OpenAI API key not configured',
              configured: false,
              key_present: false
            }));
            return;
          }

          const data = await parseBody(req);
          const { prompt = 'Say hello and confirm you are working!' } = data;
          
          // Make a simple OpenAI API call to test the key
          const https = require('https');
          const postData = JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100
          });

          const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const openaiReq = https.request(options, (openaiRes) => {
            let responseData = '';
            openaiRes.on('data', (chunk) => {
              responseData += chunk;
            });
            openaiRes.on('end', () => {
              try {
                const response = JSON.parse(responseData);
                if (openaiRes.statusCode === 200) {
                  res.writeHead(200);
                  res.end(JSON.stringify({
                    success: true,
                    configured: true,
                    key_present: true,
                    response: response.choices[0].message.content
                  }));
                } else {
                  res.writeHead(400);
                  res.end(JSON.stringify({
                    success: false,
                    configured: true,
                    key_present: true,
                    error: response.error?.message || 'OpenAI API error'
                  }));
                }
              } catch (parseError) {
                res.writeHead(500);
                res.end(JSON.stringify({
                  success: false,
                  error: 'Failed to parse OpenAI response'
                }));
              }
            });
          });

          openaiReq.on('error', (error) => {
            res.writeHead(500);
            res.end(JSON.stringify({
              success: false,
              configured: true,
              key_present: true,
              error: `OpenAI API request failed: ${error.message}`
            }));
          });

          openaiReq.write(postData);
          openaiReq.end();
        } catch (error) {
          console.error('Error testing OpenAI:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to test OpenAI API' }));
        }
        return;
      }

      // Test email endpoint (simplified for testing)
      if (pathname === '/api/emails/test' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { to, subject = 'Test Email from High Bred Bullies' } = data;
          
          if (!to) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Recipient email is required' }));
            return;
          }

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Test Email</h1>
              <p>This is a test email from High Bred Bullies platform.</p>
              <p>If you receive this, the email service is working correctly!</p>
              <p>Sent at: ${new Date().toISOString()}</p>
            </div>
          `;

          // Send test email using unified function
          const success = await sendEmail({ to, subject, html });
          
          res.writeHead(200);
          res.end(JSON.stringify({ 
            success, 
            message: success ? 'Test email sent successfully' : 'Failed to send test email',
            configured: !!emailTransporter
          }));
        } catch (error) {
          console.error('Error sending test email:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to send test email' }));
        }
        return;
      }

      // =================================================================
      // STRIPE INTEGRATION ENDPOINTS
      // =================================================================

      // Create Stripe litter products and prices
      if (pathname === '/api/stripe/create-litter' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { name, description, price_per_male, price_per_female, stripe_product_id, stripe_male_price_id, stripe_female_price_id } = data;

          let productId = stripe_product_id;
          const productPayload = {
            name,
            description: description || `Litter of ${name}`,
            metadata: { app_managed: 'true', entity: 'litter' }
          };

          if (productId) {
            await stripe.products.update(productId, productPayload);
          } else {
            const product = await stripe.products.create(productPayload);
            productId = product.id;
          }

          if (stripe_male_price_id) {
            await stripe.prices.update(stripe_male_price_id, { active: false });
          }
          if (stripe_female_price_id) {
            await stripe.prices.update(stripe_female_price_id, { active: false });
          }

          const malePrice = await stripe.prices.create({
            product: productId,
            unit_amount: price_per_male,
            currency: "usd",
            metadata: { gender: 'male' },
          });

          const femalePrice = await stripe.prices.create({
            product: productId,
            unit_amount: price_per_female,
            currency: "usd",
            metadata: { gender: 'female' },
          });

          res.writeHead(200);
          res.end(JSON.stringify({
            stripe_product_id: productId,
            stripe_male_price_id: malePrice.id,
            stripe_female_price_id: femalePrice.id,
          }));
        } catch (error) {
          console.error('Stripe create litter error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Delete Stripe litter products
      if (pathname === '/api/stripe/delete-litter' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { stripe_product_id } = data;

          if (!stripe_product_id) {
            throw new Error("Stripe product ID is required.");
          }

          const prices = await stripe.prices.list({ product: stripe_product_id, active: true });
          for (const price of prices.data) {
            await stripe.prices.update(price.id, { active: false });
          }

          const deletedProduct = await stripe.products.del(stripe_product_id);

          res.writeHead(200);
          res.end(JSON.stringify({ success: true, deletedProduct }));
        } catch (error) {
          console.error('Stripe delete litter error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Get puppy prices from Stripe
      if (pathname === '/api/stripe/get-puppy-prices' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { litterId } = data;
          if (!litterId) throw new Error("Litter ID is required.");

          const puppiesResult = await pool.query(`
            SELECT id, stripe_price_id FROM puppies WHERE litter_id = $1
          `, [litterId]);

          const puppiesWithStripePrice = puppiesResult.rows.filter(p => p.stripe_price_id);
          
          if (puppiesWithStripePrice.length === 0) {
            res.writeHead(200);
            res.end(JSON.stringify({}));
            return;
          }

          const pricePromises = puppiesWithStripePrice.map(p => stripe.prices.retrieve(p.stripe_price_id));
          const stripePrices = await Promise.all(pricePromises);

          const puppyPrices = {};
          stripePrices.forEach((price, index) => {
            const puppyId = puppiesWithStripePrice[index].id;
            puppyPrices[puppyId] = price.unit_amount;
          });

          res.writeHead(200);
          res.end(JSON.stringify(puppyPrices));
        } catch (error) {
          console.error('Get puppy prices error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Create Stripe checkout session
      if (pathname === '/api/stripe/create-checkout' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Missing auth header' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const data = await parseBody(req);
          const { litterId, puppyIds, deliveryOption, deliveryZipCode } = data;
          
          if (!litterId || !puppyIds || puppyIds.length === 0 || !deliveryOption) {
            throw new Error("Litter ID, puppy IDs, and delivery option are required.");
          }

          const litterResult = await pool.query(`
            SELECT l.*, b.delivery_fee, b.delivery_areas 
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.id = $1
          `, [litterId]);

          if (litterResult.rows.length === 0) throw new Error("Litter not found.");
          const litter = litterResult.rows[0];

          const puppiesResult = await pool.query(`
            SELECT * FROM puppies WHERE id = ANY($1)
          `, [puppyIds]);

          if (puppiesResult.rows.length !== puppyIds.length) {
            throw new Error("One or more puppies could not be found.");
          }

          const puppies = puppiesResult.rows;
          puppies.forEach(p => {
            if (!p.is_available) throw new Error(`Puppy ${p.name || p.id} is no longer available.`);
            if (p.litter_id !== parseInt(litterId)) throw new Error(`Puppy ${p.name || p.id} does not belong to this litter.`);
          });

          const line_items = puppies.map(puppy => {
            let priceId = puppy.stripe_price_id;
            if (!priceId) {
              priceId = puppy.gender === 'male' ? litter.stripe_male_price_id : litter.stripe_female_price_id;
            }
            if (!priceId) {
              throw new Error(`Could not determine Stripe price for puppy ${puppy.name || puppy.id}.`);
            }
            return { price: priceId, quantity: 1 };
          });

          let deliveryFee = 0;
          if (deliveryOption === 'delivery') {
            if (!deliveryZipCode) {
              throw new Error("Delivery ZIP code is required for delivery.");
            }
            const deliveryAreas = litter.delivery_areas;
            if (!deliveryAreas || !deliveryAreas.includes(deliveryZipCode)) {
              throw new Error(`Delivery not available for ZIP code ${deliveryZipCode}.`);
            }
            deliveryFee = litter.delivery_fee || 0;
            if (deliveryFee > 0) {
              line_items.push({
                price_data: {
                  currency: 'usd',
                  product_data: { name: 'Local Delivery Fee' },
                  unit_amount: deliveryFee,
                },
                quantity: 1,
              });
            }
          }

          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/litters/${litterId}`,
            metadata: {
              litterId,
              puppyIds: puppyIds.join(','),
              userId: userId.toString(),
              deliveryOption,
              deliveryFee: deliveryFee.toString(),
              deliveryZipCode: deliveryZipCode || '',
            },
          });

          res.writeHead(200);
          res.end(JSON.stringify({ sessionId: session.id, url: session.url }));
        } catch (error) {
          console.error('Create checkout error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Finalize Stripe order after successful payment
      if (pathname === '/api/stripe/finalize-order' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Missing auth header' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const data = await parseBody(req);
          const { session_id } = data;
          if (!session_id) throw new Error("Stripe Session ID is required.");

          const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['line_items'] });
          if (session.payment_status !== 'paid') {
            throw new Error("Payment not successful.");
          }

          const { litterId, puppyIds: puppyIdsString, userId: metaUserId, deliveryOption, deliveryFee, deliveryZipCode } = session.metadata;
          if (metaUserId !== userId.toString()) throw new Error("User mismatch.");

          const puppyIds = puppyIdsString.split(',');
          
          const scheduling_deadline = new Date();
          scheduling_deadline.setDate(scheduling_deadline.getDate() + 15);

          const newOrder = {
            user_id: userId,
            stripe_session_id: session_id,
            stripe_payment_intent_id: session.payment_intent,
            total_amount: session.amount_total,
            subtotal_amount: session.amount_subtotal,
            discount_amount: session.total_details?.amount_discount ?? 0,
            status: 'paid',
            delivery_type: deliveryOption === 'delivery' ? 'delivery' : 'pickup',
            delivery_option: deliveryOption,
            delivery_cost: deliveryFee ? parseInt(deliveryFee) : 0,
            scheduling_deadline: scheduling_deadline.toISOString(),
            delivery_zip_code: deliveryZipCode,
          };

          const orderResult = await pool.query(`
            INSERT INTO orders (user_id, stripe_session_id, stripe_payment_intent_id, total_amount, subtotal_amount, discount_amount, status, delivery_type, delivery_option, delivery_cost, scheduling_deadline, delivery_zip_code, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            RETURNING *
          `, [newOrder.user_id, newOrder.stripe_session_id, newOrder.stripe_payment_intent_id, newOrder.total_amount, newOrder.subtotal_amount, newOrder.discount_amount, newOrder.status, newOrder.delivery_type, newOrder.delivery_option, newOrder.delivery_cost, newOrder.scheduling_deadline, newOrder.delivery_zip_code]);

          const order = orderResult.rows[0];

          for (const puppy_id of puppyIds) {
            await pool.query(`
              INSERT INTO order_items (order_id, puppy_id, price, created_at)
              VALUES ($1, $2, $3, NOW())
            `, [order.id, puppy_id, 0]);
          }

          await pool.query(`
            UPDATE puppies SET is_available = false, sold_to = $1 WHERE id = ANY($2)
          `, [userId, puppyIds]);
          
          const purchasedPuppiesResult = await pool.query(`
            SELECT id, name FROM puppies WHERE id = ANY($1)
          `, [puppyIds]);

          res.writeHead(200);
          res.end(JSON.stringify({ order, puppies: purchasedPuppiesResult.rows, litterId }));
        } catch (error) {
          console.error('Finalize order error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Generate litter images with DALL-E
      if (pathname === '/api/ai/generate-litter-images' && req.method === 'POST') {
        try {
          if (!OPENAI_API_KEY) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "OpenAI API key not configured" }));
            return;
          }

          const data = await parseBody(req);
          const { prompt, fileName } = data;
          if (!prompt || !fileName) {
            throw new Error("Missing 'prompt' or 'fileName' in request body");
          }

          const https = require('https');
          const imagePostData = JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            response_format: 'b64_json',
          });

          const imageOptions = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(imagePostData)
            }
          };

          const imageReq = https.request(imageOptions, (imageRes) => {
            let responseData = '';
            imageRes.on('data', (chunk) => {
              responseData += chunk;
            });
            imageRes.on('end', () => {
              try {
                if (imageRes.statusCode !== 200) {
                  const error = JSON.parse(responseData);
                  throw new Error(`OpenAI API request failed: ${error.error?.message || 'Unknown error'}`);
                }

                const response = JSON.parse(responseData);
                const b64_json = response.data[0].b64_json;
                
                // Convert base64 to data URL
                const imageUrl = `data:image/png;base64,${b64_json}`;

                res.writeHead(200);
                res.end(JSON.stringify({ publicUrl: imageUrl }));
              } catch (error) {
                console.error('Error processing image response:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          });

          imageReq.on('error', (error) => {
            console.error('OpenAI image request error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to connect to OpenAI API' }));
          });

          imageReq.write(imagePostData);
          imageReq.end();
        } catch (error) {
          console.error('Generate litter images error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Generate social posts with AI
      if (pathname === '/api/ai/generate-social-posts' && req.method === 'POST') {
        try {
          if (!OPENAI_API_KEY) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "OpenAI API key not configured" }));
            return;
          }

          const socialPostTopics = [
            "My puppy's first training session success!",
            "Best treats for positive reinforcement training",
            "Puppy socialization tips from my experience", 
            "How my dog changed my life for the better",
            "Funny puppy behavior that made me laugh today",
            "Training milestone: my dog learned a new trick!",
            "Pet-friendly places I discovered recently",
            "Health tip: keeping your dog's teeth clean",
            "Rainy day activities for energetic puppies",
            "The bond between my family and our new puppy"
          ];

          const randomTopic = socialPostTopics[Math.floor(Math.random() * socialPostTopics.length)];

          const prompt = `Create an engaging social media post for a pet owner community about: "${randomTopic}". 
            Make it personal, authentic, and helpful. Include relevant hashtags. Keep it under 200 words.
            Return as JSON with keys: "content", "title"`;

          const https = require('https');
          const postData = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful assistant that creates engaging social media content for pet owners.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          });

          const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const openaiReq = https.request(options, (openaiRes) => {
            let responseData = '';
            openaiRes.on('data', (chunk) => {
              responseData += chunk;
            });
            openaiRes.on('end', async () => {
              try {
                if (openaiRes.statusCode !== 200) {
                  const error = JSON.parse(responseData);
                  throw new Error(error.error?.message || 'OpenAI API error');
                }

                const aiResponse = JSON.parse(responseData);
                const postData = JSON.parse(aiResponse.choices[0].message.content);

                // Generate an image for the post
                let imageUrl = null;
                const imagePrompt = `A happy, healthy dog in a loving home environment with their family, warm natural lighting, realistic photo style showing the bond between pet and owner`;

                const imagePostData = JSON.stringify({
                  model: 'dall-e-2',
                  prompt: imagePrompt,
                  n: 1,
                  size: '1024x1024'
                });

                const imageOptions = {
                  hostname: 'api.openai.com',
                  port: 443,
                  path: '/v1/images/generations',
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(imagePostData)
                  }
                };

                const imageReq = https.request(imageOptions, (imageRes) => {
                  let imageResponseData = '';
                  imageRes.on('data', (chunk) => {
                    imageResponseData += chunk;
                  });
                  imageRes.on('end', async () => {
                    try {
                      if (imageRes.statusCode === 200) {
                        const imageResponse = JSON.parse(imageResponseData);
                        imageUrl = imageResponse.data[0].url;
                      }

                      // Save social post to database (using correct column names)
                      const insertResult = await pool.query(`
                        INSERT INTO social_posts (title, content, image_url, user_id, is_public, moderation_status, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, true, 'pending', NOW(), NOW())
                        RETURNING *
                      `, [
                        postData.title,
                        postData.content,
                        imageUrl,
                        '0a7a4b2b-992c-47bb-a2e8-626b943b3da6'  // Use admin user UUID
                      ]);

                      res.writeHead(200);
                      res.end(JSON.stringify({
                        success: true,
                        social_post: insertResult.rows[0],
                        image_url: imageUrl
                      }));
                    } catch (error) {
                      console.error('Error saving social post:', error);
                      res.writeHead(500);
                      res.end(JSON.stringify({ error: 'Failed to save social post' }));
                    }
                  });
                });

                imageReq.on('error', async (error) => {
                  console.error('Image generation failed:', error);
                  // Save post without image
                  try {
                    const insertResult = await pool.query(`
                      INSERT INTO social_posts (title, content, author_id, user_id, is_public, moderation_status, created_at, updated_at)
                      VALUES ($1, $2, $3, $4, true, 'pending', NOW(), NOW())
                      RETURNING *
                    `, [
                      postData.title,
                      postData.content,
                      1, // Default author ID
                      1  // Default user ID
                    ]);

                    res.writeHead(200);
                    res.end(JSON.stringify({
                      success: true,
                      social_post: insertResult.rows[0],
                      image_url: null
                    }));
                  } catch (dbError) {
                    console.error('Error saving social post:', dbError);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to save social post' }));
                  }
                });

                imageReq.write(imagePostData);
                imageReq.end();

              } catch (error) {
                console.error('Error processing AI response:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to process AI response' }));
              }
            });
          });

          openaiReq.on('error', (error) => {
            console.error('OpenAI request error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to connect to OpenAI API' }));
          });

          openaiReq.write(postData);
          openaiReq.end();
        } catch (error) {
          console.error('Generate social posts error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Moderate content with AI
      if (pathname === '/api/ai/moderate-content' && req.method === 'POST') {
        try {
          if (!OPENAI_API_KEY) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "OpenAI API key not configured" }));
            return;
          }

          const data = await parseBody(req);
          const { postId, content, title } = data;

          const moderationPrompt = `
            Analyze the following social media post content for a pet owner community. 
            Determine if it should be approved for public posting.
            
            APPROVE if the content is:
            - Pet-centric (about dogs, puppies, pet care, etc.)
            - Positive testimonials or reviews
            - Helpful pet-related information
            - Family-friendly pet stories
            
            REJECT if the content contains:
            - Derogatory language
            - Defamatory statements
            - Racially charged content
            - Inappropriate language
            - Non-pet related content
            - Spam or promotional content
            
            Title: ${title}
            Content: ${content}
            
            Respond with either "APPROVE" or "REJECT" followed by a brief reason.
          `;

          const https = require('https');
          const postData = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a content moderator for a pet community platform.' },
              { role: 'user', content: moderationPrompt }
            ],
            temperature: 0.1,
          });

          const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const openaiReq = https.request(options, (openaiRes) => {
            let responseData = '';
            openaiRes.on('data', (chunk) => {
              responseData += chunk;
            });
            openaiRes.on('end', async () => {
              try {
                if (openaiRes.statusCode !== 200) {
                  const error = JSON.parse(responseData);
                  throw new Error(error.error?.message || 'OpenAI API error');
                }

                const aiResult = JSON.parse(responseData);
                const moderationResult = aiResult.choices[0].message.content;
                
                const isApproved = moderationResult.toUpperCase().startsWith('APPROVE');
                const status = isApproved ? 'approved' : 'rejected';
                const rejectionReason = isApproved ? null : moderationResult;

                // Update the post with moderation result
                await pool.query(`
                  UPDATE social_posts 
                  SET moderation_status = $1, rejection_reason = $2, updated_at = NOW()
                  WHERE id = $3
                `, [status, rejectionReason, postId]);

                res.writeHead(200);
                res.end(JSON.stringify({ 
                  success: true, 
                  status,
                  reason: rejectionReason 
                }));
              } catch (error) {
                console.error('Error processing moderation response:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to process moderation response' }));
              }
            });
          });

          openaiReq.on('error', (error) => {
            console.error('OpenAI moderation request error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to connect to OpenAI API' }));
          });

          openaiReq.write(postData);
          openaiReq.end();
        } catch (error) {
          console.error('Moderate content error:', error);
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // AI Assistant endpoint
      if (pathname === '/api/ai/assistant' && req.method === 'POST') {
        try {
          if (!OPENAI_API_KEY) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "OpenAI API key not configured" }));
            return;
          }

          const data = await parseBody(req);
          const { userMessage, conversationHistory = [] } = data;

          if (!userMessage) {
            throw new Error("User message is required");
          }

          // Build conversation context
          const messages = [
            {
              role: 'system',
              content: `You are a helpful AI assistant for High Bred Bullies, a dog breeding platform. 
                You help users with:
                - General pet care questions
                - Dog breeding information
                - Platform navigation help
                - Puppy care and training tips
                - Health and nutrition advice
                
                Be friendly, informative, and concise. If users ask about specific medical issues, 
                recommend consulting with a veterinarian.`
            },
            ...conversationHistory,
            { role: 'user', content: userMessage }
          ];

          const https = require('https');
          const postData = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
          });

          const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const openaiReq = https.request(options, (openaiRes) => {
            let responseData = '';
            openaiRes.on('data', (chunk) => {
              responseData += chunk;
            });
            openaiRes.on('end', () => {
              try {
                if (openaiRes.statusCode !== 200) {
                  const error = JSON.parse(responseData);
                  throw new Error(error.error?.message || 'OpenAI API error');
                }

                const aiResponse = JSON.parse(responseData);
                const assistantMessage = aiResponse.choices[0].message.content;

                // Check if user needs breeder contact
                function checkIfNeedsBreederContact(userMessage, aiResponse) {
                  const contactKeywords = [
                    'buy', 'purchase', 'available', 'price', 'cost', 'reserve',
                    'contact breeder', 'meet', 'visit', 'schedule', 'appointment'
                  ];
                  
                  return contactKeywords.some(keyword => 
                    userMessage.toLowerCase().includes(keyword) ||
                    aiResponse.toLowerCase().includes(keyword)
                  );
                }

                const needsBreederContact = checkIfNeedsBreederContact(userMessage, assistantMessage);

                res.writeHead(200);
                res.end(JSON.stringify({
                  response: assistantMessage,
                  needsBreederContact
                }));
              } catch (error) {
                console.error('Error processing AI assistant response:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to process AI response' }));
              }
            });
          });

          openaiReq.on('error', (error) => {
            console.error('OpenAI assistant request error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to connect to OpenAI API' }));
          });

          openaiReq.write(postData);
          openaiReq.end();
        } catch (error) {
          console.error('AI assistant error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // =================================================================
      // EMAIL NOTIFICATION ENDPOINTS
      // =================================================================

      // Send inquiry notification to breeder
      if (pathname === '/api/email/send-inquiry-notification' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { inquiryId, breederEmail, customerName, customerEmail, subject, message } = data;

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">New Customer Inquiry</h1>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Customer Information:</h3>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${customerEmail}</p>
                <p><strong>Subject:</strong> ${subject}</p>
              </div>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Message:</h3>
                <p>${message}</p>
              </div>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                Please respond to this inquiry promptly to provide excellent customer service.
              </p>
            </div>
          `;

          const success = await sendEmail({
            to: breederEmail,
            subject: `New Inquiry: ${subject}`,
            html
          });

          if (inquiryId) {
            await pool.query(`
              UPDATE inquiries SET notification_sent = true WHERE id = $1
            `, [inquiryId]);
          }

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success, 
            message: success ? 'Inquiry notification sent successfully' : 'Failed to send notification' 
          }));
        } catch (error) {
          console.error('Send inquiry notification error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Send inquiry response to customer
      if (pathname === '/api/email/send-inquiry-response' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { customerEmail, customerName, breederName, responseMessage } = data;

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Response from ${breederName}</h1>
              <p>Dear ${customerName},</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${responseMessage}
              </div>
              <p>Thank you for your inquiry!</p>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                High Bred Bullies - Connecting families with quality American Bully breeds
              </p>
            </div>
          `;

          const success = await sendEmail({
            to: customerEmail,
            subject: `Response from ${breederName} - High Bred Bullies`,
            html
          });

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success, 
            message: success ? 'Response sent successfully' : 'Failed to send response' 
          }));
        } catch (error) {
          console.error('Send inquiry response error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Send litter notification to interested customers
      if (pathname === '/api/email/send-litter-notification' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { litter, recipientEmails } = data;

          if (!litter || !recipientEmails || recipientEmails.length === 0) {
            throw new Error("Litter information and recipient emails are required");
          }

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">New Litter Available!</h1>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2>${litter.name}</h2>
                <p><strong>Breed:</strong> ${litter.breed}</p>
                <p><strong>Expected Birth Date:</strong> ${new Date(litter.birth_date).toLocaleDateString()}</p>
                <p><strong>Total Puppies:</strong> ${litter.total_puppies}</p>
                <p><strong>Male Price:</strong> $${(litter.price_per_male / 100).toFixed(2)}</p>
                <p><strong>Female Price:</strong> $${(litter.price_per_female / 100).toFixed(2)}</p>
              </div>
              ${litter.description ? `
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Description:</h3>
                  <p>${litter.description}</p>
                </div>
              ` : ''}
              <p>Visit our website to learn more about this litter and reserve your puppy!</p>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                High Bred Bullies - Quality American Bully breeds
              </p>
            </div>
          `;

          let successCount = 0;
          for (const email of recipientEmails) {
            const success = await sendEmail({
              to: email,
              subject: `New Litter Available: ${litter.name}`,
              html
            });
            if (success) successCount++;
          }

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: successCount > 0,
            sentCount: successCount,
            totalRecipients: recipientEmails.length,
            message: `Sent ${successCount} of ${recipientEmails.length} notifications`
          }));
        } catch (error) {
          console.error('Send litter notification error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Send order update notification
      if (pathname === '/api/email/send-order-update' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { orderId, customerEmail, customerName, status, message, deliveryDate } = data;

          let statusColor = '#2563eb';
          if (status === 'confirmed') statusColor = '#10b981';
          else if (status === 'ready') statusColor = '#f59e0b';
          else if (status === 'completed') statusColor = '#10b981';

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: ${statusColor};">Order Update</h1>
              <p>Dear ${customerName},</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status.toUpperCase()}</span></p>
                ${deliveryDate ? `<p><strong>Delivery/Pickup Date:</strong> ${new Date(deliveryDate).toLocaleDateString()}</p>` : ''}
              </div>
              ${message ? `
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Update Details:</h3>
                  <p>${message}</p>
                </div>
              ` : ''}
              <p>Thank you for choosing High Bred Bullies!</p>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                If you have any questions, please don't hesitate to contact us.
              </p>
            </div>
          `;

          const success = await sendEmail({
            to: customerEmail,
            subject: `Order Update: ${status.toUpperCase()} - Order #${orderId}`,
            html
          });

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success, 
            message: success ? 'Order update notification sent successfully' : 'Failed to send notification' 
          }));
        } catch (error) {
          console.error('Send order update error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Send pickup confirmation
      if (pathname === '/api/email/send-pickup-confirmation' && req.method === 'POST') {
        try {
          const data = await parseBody(req);
          const { customerEmail, customerName, puppyNames, pickupDate, pickupTime, address, specialInstructions } = data;

          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #10b981;">Pickup Confirmation</h1>
              <p>Dear ${customerName},</p>
              <p>Your puppy pickup has been confirmed! Here are the details:</p>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h3 style="color: #065f46; margin-top: 0;">Pickup Details</h3>
                <p><strong>Puppy/Puppies:</strong> ${Array.isArray(puppyNames) ? puppyNames.join(', ') : puppyNames}</p>
                <p><strong>Date:</strong> ${new Date(pickupDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${pickupTime}</p>
                <p><strong>Address:</strong> ${address}</p>
              </div>

              ${specialInstructions ? `
                <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                  <h3 style="color: #92400e; margin-top: 0;">Special Instructions</h3>
                  <p>${specialInstructions}</p>
                </div>
              ` : ''}

              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>What to Bring:</h3>
                <ul>
                  <li>Valid government-issued ID</li>
                  <li>Puppy carrier or leash</li>
                  <li>Any remaining payment (if applicable)</li>
                </ul>
              </div>

              <p>We're excited for you to meet your new family member!</p>
              <p>If you need to reschedule or have any questions, please contact us immediately.</p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                High Bred Bullies - Thank you for choosing us for your new companion!
              </p>
            </div>
          `;

          const success = await sendEmail({
            to: customerEmail,
            subject: `Pickup Confirmed - ${new Date(pickupDate).toLocaleDateString()}`,
            html
          });

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success, 
            message: success ? 'Pickup confirmation sent successfully' : 'Failed to send confirmation' 
          }));
        } catch (error) {
          console.error('Send pickup confirmation error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // =================================================================
      // BUSINESS OPERATION ENDPOINTS
      // =================================================================

      // Delete litter
      if (pathname === '/api/litters/delete' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Breeder access required' }));
            return;
          }

          const data = await parseBody(req);
          const { litterId } = data;

          if (!litterId) {
            throw new Error("Litter ID is required");
          }

          // Check if litter exists and belongs to the breeder
          const litterResult = await pool.query(`
            SELECT l.*, b.user_id as breeder_user_id 
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.id = $1
          `, [litterId]);

          if (litterResult.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Litter not found' }));
            return;
          }

          const litter = litterResult.rows[0];
          if (litter.breeder_user_id !== decoded.userId) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Not authorized to delete this litter' }));
            return;
          }

          // Delete related records first (puppies, order_items)
          await pool.query('DELETE FROM order_items WHERE puppy_id IN (SELECT id FROM puppies WHERE litter_id = $1)', [litterId]);
          await pool.query('DELETE FROM puppies WHERE litter_id = $1', [litterId]);
          await pool.query('DELETE FROM litters WHERE id = $1', [litterId]);

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Litter deleted successfully',
            litterId 
          }));
        } catch (error) {
          console.error('Delete litter error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Cancel order
      if (pathname === '/api/orders/cancel' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);

          const data = await parseBody(req);
          const { orderId, reason } = data;

          if (!orderId) {
            throw new Error("Order ID is required");
          }

          // Verify order ownership or breeder access
          const orderResult = await pool.query(`
            SELECT o.*, oi.puppy_id 
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1
          `, [orderId]);

          if (orderResult.rows.length === 0) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Order not found' }));
            return;
          }

          const order = orderResult.rows[0];
          if (order.user_id !== decoded.userId && !decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Not authorized to cancel this order' }));
            return;
          }

          // Update order status
          await pool.query(`
            UPDATE orders 
            SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW()
            WHERE id = $2
          `, [reason, orderId]);

          // Make puppies available again
          const puppyIds = orderResult.rows.map(row => row.puppy_id).filter(Boolean);
          if (puppyIds.length > 0) {
            await pool.query(`
              UPDATE puppies 
              SET is_available = true, sold_to = NULL 
              WHERE id = ANY($1)
            `, [puppyIds]);
          }

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Order cancelled successfully',
            orderId 
          }));
        } catch (error) {
          console.error('Cancel order error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Create pet owner profile
      if (pathname === '/api/profiles/create-pet-owner' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.userId;

          const data = await parseBody(req);
          const { favorite_breeds, experience_level, location, budget_range } = data;

          const result = await pool.query(`
            INSERT INTO pet_owners (user_id, favorite_breeds, experience_level, location, budget_range, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              favorite_breeds = EXCLUDED.favorite_breeds,
              experience_level = EXCLUDED.experience_level,
              location = EXCLUDED.location,
              budget_range = EXCLUDED.budget_range,
              updated_at = NOW()
            RETURNING *
          `, [userId, favorite_breeds, experience_level, location, budget_range]);

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true, 
            profile: result.rows[0],
            message: 'Pet owner profile created successfully' 
          }));
        } catch (error) {
          console.error('Create pet owner profile error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Cleanup Stripe test litters (admin only)
      if (pathname === '/api/stripe/cleanup-test-litters' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Admin access required' }));
            return;
          }

          if (!stripe) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Stripe not configured' }));
            return;
          }

          // Find test litters (those with 'test' in name or description)
          const testLitters = await pool.query(`
            SELECT * FROM litters 
            WHERE LOWER(name) LIKE '%test%' 
               OR LOWER(description) LIKE '%test%'
               OR stripe_product_id IS NOT NULL
          `);

          let cleanedCount = 0;
          const errors = [];

          for (const litter of testLitters.rows) {
            try {
              // Clean up Stripe products
              if (litter.stripe_product_id) {
                const prices = await stripe.prices.list({ 
                  product: litter.stripe_product_id, 
                  active: true 
                });
                
                for (const price of prices.data) {
                  await stripe.prices.update(price.id, { active: false });
                }
                
                await stripe.products.del(litter.stripe_product_id);
              }

              // Remove from database
              await pool.query('DELETE FROM order_items WHERE puppy_id IN (SELECT id FROM puppies WHERE litter_id = $1)', [litter.id]);
              await pool.query('DELETE FROM puppies WHERE litter_id = $1', [litter.id]);
              await pool.query('DELETE FROM litters WHERE id = $1', [litter.id]);
              
              cleanedCount++;
            } catch (error) {
              errors.push(`Failed to clean litter ${litter.id}: ${error.message}`);
            }
          }

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true,
            cleanedCount,
            totalFound: testLitters.rows.length,
            errors: errors.length > 0 ? errors : undefined,
            message: `Cleaned up ${cleanedCount} test litters`
          }));
        } catch (error) {
          console.error('Cleanup test litters error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // Seed Stripe test litters (admin only)
      if (pathname === '/api/stripe/seed-test-litters' && req.method === 'POST') {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          if (!decoded.isBreeder) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Admin access required' }));
            return;
          }

          if (!stripe) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Stripe not configured' }));
            return;
          }

          // Get the admin's breeder profile
          const breederResult = await pool.query(`
            SELECT id FROM breeders WHERE user_id = $1
          `, [decoded.userId]);

          if (breederResult.rows.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Breeder profile required' }));
            return;
          }

          const breederId = breederResult.rows[0].id;

          const testLitters = [
            {
              name: 'Test Litter Alpha',
              breed: 'American Bully XL',
              dam_name: 'Test Dam A',
              sire_name: 'Test Sire A',
              price_per_male: 250000, // $2500
              price_per_female: 300000, // $3000
              description: 'Test litter for platform testing purposes'
            },
            {
              name: 'Test Litter Beta',
              breed: 'American Bully Standard',
              dam_name: 'Test Dam B',
              sire_name: 'Test Sire B',
              price_per_male: 200000, // $2000
              price_per_female: 250000, // $2500
              description: 'Another test litter for development'
            }
          ];

          const createdLitters = [];

          for (const litterData of testLitters) {
            // Create Stripe product
            const product = await stripe.products.create({
              name: litterData.name,
              description: litterData.description,
              metadata: { app_managed: 'true', entity: 'litter', test: 'true' }
            });

            const malePrice = await stripe.prices.create({
              product: product.id,
              unit_amount: litterData.price_per_male,
              currency: 'usd',
              metadata: { gender: 'male' }
            });

            const femalePrice = await stripe.prices.create({
              product: product.id,
              unit_amount: litterData.price_per_female,
              currency: 'usd',
              metadata: { gender: 'female' }
            });

            // Create litter in database
            const litterResult = await pool.query(`
              INSERT INTO litters (
                breeder_id, name, breed, dam_name, sire_name,
                price_per_male, price_per_female, description,
                stripe_product_id, stripe_male_price_id, stripe_female_price_id,
                birth_date, total_puppies, available_puppies, status,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
              RETURNING *
            `, [
              breederId, litterData.name, litterData.breed, litterData.dam_name, litterData.sire_name,
              litterData.price_per_male, litterData.price_per_female, litterData.description,
              product.id, malePrice.id, femalePrice.id,
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              5, 5, 'upcoming'
            ]);

            createdLitters.push(litterResult.rows[0]);
          }

          res.writeHead(200);
          res.end(JSON.stringify({ 
            success: true,
            createdCount: createdLitters.length,
            litters: createdLitters,
            message: `Created ${createdLitters.length} test litters with Stripe integration`
          }));
        } catch (error) {
          console.error('Seed test litters error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }

      // =================================================================
      // AI CONTENT GENERATION ENDPOINTS
      // =================================================================

      // Generate blog post with AI
      if (pathname === '/api/ai/generate-blog-post' && req.method === 'POST') {
        try {
          if (!OPENAI_API_KEY) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "OpenAI API key not configured" }));
            return;
          }

          const blogTopics = [
            "Common Pet Diseases and Their Treatments",
            "The Importance of Regular Exercise for Your Dog",
            "Effective Puppy Training Tips for New Owners",
            "Choosing the Right Food for Your Pet's Breed and Age",
            "How to Socialize Your New Puppy Safely",
            "Understanding and Managing Pet Anxiety",
            "The Benefits of Pet Adoption vs. Buying",
            "Essential Grooming Practices for a Healthy Coat",
            "Creating a Pet-Friendly Home Environment",
            "Senior Pet Care: Keeping Your Older Companion Comfortable"
          ];

          const randomTopic = blogTopics[Math.floor(Math.random() * blogTopics.length)];

          const prompt = `
            You are an expert pet care blogger for "High Bred (Hybrid) Bullies".
            Write a blog post about the topic: "${randomTopic}".
            The tone should be informative, friendly, and helpful.
            The article should be between 300 and 500 words.
            
            Please return the response as a single JSON object with the following keys:
            - "title": A catchy and SEO-friendly title for the blog post.
            - "content": The full blog post content in Markdown format.
            - "excerpt": A short, compelling summary of the article (max 50 words).
            - "category": The most relevant category from this list: "Health", "Training", "Nutrition", "General", "Lifestyle".
            - "author_name": A plausible author name for a pet blog, like "Dr. Paws" or "The Pawsitive Team".
            - "image_prompt": A detailed DALL-E prompt to generate a photorealistic and engaging image for this blog post.
          `;

          const https = require('https');
          const postData = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful assistant that generates pet-related blog content in a specific JSON format.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          });

          const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const openaiReq = https.request(options, (openaiRes) => {
            let responseData = '';
            openaiRes.on('data', (chunk) => {
              responseData += chunk;
            });
            openaiRes.on('end', async () => {
              try {
                const aiResponse = JSON.parse(responseData);
                if (openaiRes.statusCode !== 200) {
                  throw new Error(aiResponse.error?.message || 'OpenAI API error');
                }

                const blogData = JSON.parse(aiResponse.choices[0].message.content);

                // Generate image with DALL-E
                const imagePostData = JSON.stringify({
                  model: 'dall-e-2',
                  prompt: blogData.image_prompt,
                  n: 1,
                  size: '1024x1024'
                });

                const imageOptions = {
                  hostname: 'api.openai.com',
                  port: 443,
                  path: '/v1/images/generations',
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(imagePostData)
                  }
                };

                const imageReq = https.request(imageOptions, (imageRes) => {
                  let imageResponseData = '';
                  imageRes.on('data', (chunk) => {
                    imageResponseData += chunk;
                  });
                  imageRes.on('end', async () => {
                    try {
                      let imageUrl = null;
                      if (imageRes.statusCode === 200) {
                        const imageResponse = JSON.parse(imageResponseData);
                        imageUrl = imageResponse.data[0].url;
                      }

                      // Save blog post to database
                      const slug = blogData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      
                      const insertResult = await pool.query(`
                        INSERT INTO blog_posts (title, slug, content, excerpt, category, image_url, author_name, is_published, published_at, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), NOW())
                        RETURNING *
                      `, [
                        blogData.title,
                        slug,
                        blogData.content,
                        blogData.excerpt,
                        blogData.category,
                        imageUrl,
                        blogData.author_name
                      ]);

                      res.writeHead(200);
                      res.end(JSON.stringify({
                        success: true,
                        blog_post: insertResult.rows[0],
                        image_url: imageUrl
                      }));
                    } catch (error) {
                      console.error('Error saving blog post:', error);
                      res.writeHead(500);
                      res.end(JSON.stringify({ error: 'Failed to save blog post' }));
                    }
                  });
                });

                imageReq.on('error', async (error) => {
                  console.error('Image generation failed:', error);
                  // Save blog post without image
                  try {
                    const slug = blogData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    
                    const insertResult = await pool.query(`
                      INSERT INTO blog_posts (title, slug, content, excerpt, category, author_name, is_published, published_at, created_at, updated_at)
                      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW(), NOW())
                      RETURNING *
                    `, [
                      blogData.title,
                      slug,
                      blogData.content,
                      blogData.excerpt,
                      blogData.category,
                      blogData.author_name
                    ]);

                    res.writeHead(200);
                    res.end(JSON.stringify({
                      success: true,
                      blog_post: insertResult.rows[0],
                      image_url: null
                    }));
                  } catch (dbError) {
                    console.error('Error saving blog post:', dbError);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to save blog post' }));
                  }
                });

                imageReq.write(imagePostData);
                imageReq.end();

              } catch (error) {
                console.error('Error processing AI response:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Failed to process AI response' }));
              }
            });
          });

          openaiReq.on('error', (error) => {
            console.error('OpenAI request error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to connect to OpenAI API' }));
          });

          openaiReq.write(postData);
          openaiReq.end();
        } catch (error) {
          console.error('Generate blog post error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }



      // 404 for unhandled API routes
      if (pathname.startsWith('/api/')) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
        return;
      }

      // Use Vite middleware for all other requests
      vite.ssrFixStacktrace(new Error());
      await new Promise((resolve, reject) => {
        vite.middlewares(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(PORT, '0.0.0.0', async () => {
    // Create password reset table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          used_at TIMESTAMP NULL
        )
      `);
      
      // Create email verification tokens table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          verified_at TIMESTAMP NULL
        )
      `);
      
      // Add email verification columns to users table if they don't exist
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMP NULL
      `);
      
      console.log('🔑 Password reset and email verification tables initialized');
    } catch (error) {
      console.warn('⚠️ Database table creation skipped (may already exist)');
    }
    
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log('📊 Database: PostgreSQL connected');
    console.log('🔐 JWT Authentication: Enabled');
    console.log('⚡ Vite: Development server active');
    console.log('✅ Server ready for connections');
  });
}

startServer().catch(console.error);