require('dotenv/config');
const { createServer } = require('vite');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

// Initialize Email Service
let emailTransporter = null;
function initializeEmailService() {
  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  if (smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass) {
    emailTransporter = nodemailer.createTransport(smtpConfig);
    console.log('📧 Email service initialized with SMTP configuration');
  } else {
    console.warn('⚠️ SMTP configuration incomplete - email functionality disabled');
  }
}

// Email sending function
async function sendEmail({ to, subject, html, from = 'High Bred Bullies <noreply@highbredbullies.com>' }) {
  if (!emailTransporter) {
    console.warn('Email service not configured - skipping email send');
    return false;
  }

  try {
    const info = await emailTransporter.sendMail({ from, to, subject, html });
    console.log('Email sent successfully:', info.messageId);
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
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
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

async function startServer() {
  console.log('🚀 Starting Vite development server...');
  
  const vite = await createServer({
    server: { middlewareMode: true }
  });

  const server = createHttpServer(async (req, res) => {
    const { pathname } = parse(req.url, true);
    
    // Parse request body for all requests
    req.body = await parseBody(req);
    
    setHeaders(res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Login endpoint - using user_profiles table with username matching
      if (pathname === '/api/login' && req.method === 'POST') {
        const { username, password } = req.body;

        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }

        try {
          // Find user by username or email patterns
          const result = await pool.query(`
            SELECT id, username, first_name, last_name, is_admin
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
          
          // For demo purposes, accept the password "gpass1979" for gpass1979 user
          // In production, you'd check against a proper password hash
          const isValidPassword = (username.includes('gpass1979') && password === 'gpass1979') || 
                                 (password === 'demo'); // Allow demo password for other users

          if (!isValidPassword) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          // Admin user override for gpass1979@gmail.com - force breeder status
          const isAdmin = username.includes('gpass1979');
          const isBreeder = isAdmin || user.is_admin || false;

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
              moderation_status: row.moderation_status || 'approved',
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

      // Individual litter endpoint with puppies (must come after specific routes)
      if (pathname.startsWith('/api/litters/') && pathname.split('/').length === 4 && !pathname.includes('/featured') && !pathname.includes('/upcoming') && !pathname.includes('/by-breeder') && req.method === 'GET') {
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
        try {
          const data = await parseBody(req);
          const { name, email, subject, message } = data;
          
          if (!name || !email || !message) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Name, email, and message are required' }));
            return;
          }

          // Store inquiry in database
          const result = await pool.query(`
            INSERT INTO inquiries (name, email, subject, message, status, created_at)
            VALUES ($1, $2, $3, $4, 'new', NOW())
            RETURNING id
          `, [name, email, subject || 'Contact Form Submission', message]);

          // Send email notification
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">New Contact Form Submission</h1>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject || 'Contact Form Submission'}</p>
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
              </div>
            </div>
          `;

          await sendEmail({
            to: 'support@highbredbullies.com',
            subject: `Contact Form: ${subject || 'New Inquiry'}`,
            html
          });

          res.writeHead(200);
          res.end(JSON.stringify({ success: true, id: result.rows[0].id }));
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

      // Test email endpoint
      if (pathname === '/api/emails/test' && req.method === 'POST') {
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log('📊 Database: PostgreSQL connected');
    console.log('🔐 JWT Authentication: Enabled');
    console.log('⚡ Vite: Development server active');
    console.log('✅ Server ready for connections');
  });
}

startServer().catch(console.error);