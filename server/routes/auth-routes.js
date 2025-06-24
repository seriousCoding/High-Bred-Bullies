// Authentication routes
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createAuthRoutes(pool, sendEmail) {
  return {
    // Login endpoint
    async handleLogin(req, res, pathname) {
      if (pathname !== '/api/login' || req.method !== 'POST') return false;
      
      console.log('🔑 Login request received');
      try {
        const data = await parseBody(req);
        const { username, password } = data;
        console.log('📋 Login data:', { username, password: '***' });

        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return true;
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
          return true;
        }

        // Regular user authentication
        const result = await pool.query(`
          SELECT id, username, first_name, last_name, is_admin, password_hash 
          FROM user_profiles 
          WHERE username = $1 
          LIMIT 1
        `, [username]);

        if (result.rows.length === 0) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Login failed' }));
          return true;
        }

        const user = result.rows[0];
        
        // Check password if hash exists
        if (user.password_hash) {
          const passwordValid = await bcrypt.compare(password, user.password_hash);
          if (!passwordValid) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Login failed' }));
            return true;
          }
        }

        const token = jwt.sign({
          userId: user.id,
          username: user.username,
          isBreeder: user.is_admin || false
        }, JWT_SECRET, { expiresIn: '24h' });

        res.writeHead(200);
        res.end(JSON.stringify({
          token,
          user: {
            id: user.id,
            username: user.username,
            isBreeder: user.is_admin || false,
            fullName: `${user.first_name} ${user.last_name}`
          }
        }));

      } catch (error) {
        console.error('Login error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Login failed' }));
      }
      return true;
    },

    // Password reset request
    async handlePasswordResetRequest(req, res, pathname) {
      if (pathname !== '/api/password-reset/request' || req.method !== 'POST') return false;
      
      console.log('🔐 Password reset request received');
      try {
        const data = await parseBody(req);
        const { email } = data;
        console.log('📋 Password reset data:', { email });

        if (!email) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Email required' }));
          return true;
        }

        console.log('🔍 Looking for user with email:', email);
        
        // Look for user in user_profiles table (check both username and email fields)
        const userResult = await pool.query(`
          SELECT id, username, first_name, email FROM user_profiles 
          WHERE username = $1 OR email = $1
          LIMIT 1
        `, [email]);

        console.log('📊 User query result:', `${userResult.rows.length} users found`);

        if (userResult.rows.length === 0) {
          console.log('❌ No user found with email:', email);
          console.log('🔍 Available users sample:', await pool.query('SELECT username FROM user_profiles LIMIT 5'));
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'If the email exists, a reset link has been sent' }));
          return true;
        }

        const user = userResult.rows[0];
        console.log('✅ User found:', user.username);

        // Generate 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('💾 Reset code generated:', resetCode);

        // Store reset token in database (create table if needed)
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id SERIAL PRIMARY KEY,
              user_id VARCHAR(255) NOT NULL,
              token TEXT NOT NULL,
              expires_at TIMESTAMP NOT NULL,
              used_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT NOW()
            )
          `);
        } catch (tableError) {
          console.log('Password reset tokens table already exists or error:', tableError.message);
        }

        // Store both reset code and JWT token
        await pool.query(`
          INSERT INTO password_reset_tokens (user_id, token, expires_at)
          VALUES ($1, $2, NOW() + INTERVAL '1 hour'), ($1, $3, NOW() + INTERVAL '1 hour')
        `, [user.id, resetCode, resetToken]);

        console.log('💾 Reset code and token stored in database');

        const resetLink = `${req.headers.origin || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
        
        // Send password reset email with both code and link options
        const resetEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            
            <p>Hello ${user.first_name || user.username},</p>
            
            <p>You requested a password reset for your High Bred Bullies account. Choose one of these options:</p>
            
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
            
            <p style="color: #666; font-size: 14px;">Both options will expire in 1 hour for security reasons.</p>
            
            <p style="color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email.</p>
            
            <p>Best regards,<br>High Bred Bullies Team</p>
          </div>
        `;

        try {
          // Use actual email address - check email field first, then username if it's an email
          const emailAddress = user.email || (user.username && user.username.includes('@') ? user.username : null);
          
          if (!emailAddress) {
            console.log('⚠️ No valid email address for user:', user.username);
            res.writeHead(200);
            res.end(JSON.stringify({ message: 'User found but no email on file. Contact admin.' }));
            return true;
          }

          console.log(`📧 Sending reset code ${resetCode} to ${emailAddress}`);
          const emailSuccess = await sendEmail({
            to: emailAddress,
            subject: 'Password Reset Code - High Bred Bullies',
            html: resetEmailHtml
          });

          if (emailSuccess) {
            console.log(`✅ Password reset email with code ${resetCode} sent successfully to ${emailAddress}`);
          } else {
            console.error('❌ Failed to send password reset email');
          }
        } catch (emailError) {
          console.error('📧 Password reset email error:', emailError);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ message: 'If the email exists, a reset link has been sent' }));

      } catch (error) {
        console.error('🚨 Password reset request error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to process password reset request' }));
      }
      return true;
    },

    // Password reset completion
    async handlePasswordReset(req, res, pathname) {
      if (pathname !== '/api/password-reset/reset' || req.method !== 'POST') return false;
      
      console.log('🔑 Password reset completion received');
      try {
        const data = await parseBody(req);
        const { email, code, newPassword, token } = data;

        let user;
        let resetIdentifier;

        if (token) {
          // Handle JWT token reset
          const jwt = require('jsonwebtoken');
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            if (decoded.type !== 'password_reset') {
              throw new Error('Invalid token type');
            }
            
            const userResult = await pool.query(`
              SELECT id, username, email FROM user_profiles 
              WHERE id = $1
              LIMIT 1
            `, [decoded.userId]);
            
            if (userResult.rows.length === 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid reset request' }));
              return true;
            }
            
            user = userResult.rows[0];
            resetIdentifier = token;
            console.log('📋 Using JWT token reset for user:', user.username);
            
          } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid or expired reset token' }));
            return true;
          }
        } else {
          // Handle code-based reset
          if (!email || !code || !newPassword) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Email, code, and new password required' }));
            return true;
          }

          console.log('📋 Using code reset:', { email, code: '***', password: '***' });

          // Find user by email/username
          const userResult = await pool.query(`
            SELECT id, username, email FROM user_profiles 
            WHERE username = $1 OR email = $1
            LIMIT 1
          `, [email]);
          
          if (userResult.rows.length === 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid reset request' }));
            return true;
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
          res.end(JSON.stringify({ error: 'Invalid or expired reset code' }));
          return true;
        }

        const tokenRecord = tokenResult.rows[0];
        
        if (tokenRecord.used_at) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Reset code already used' }));
          return true;
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
          WHERE id = $1
        `, [tokenRecord.id]);

        console.log('✅ Password reset completed successfully for:', email);
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Password reset successfully' }));

      } catch (error) {
        console.error('🚨 Password reset completion error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to reset password' }));
      }
      return true;
    }
  };
}

module.exports = { createAuthRoutes };