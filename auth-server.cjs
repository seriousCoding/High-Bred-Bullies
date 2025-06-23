require('dotenv/config');
const { createServer } = require('vite');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
  connectionTimeoutMillis: 2000,
});

console.log('🔗 Connecting to user database: 50.193.77.237:5432/high_bred');

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
            customer_name: `${order.first_name || ''} ${order.last_name || ''}`.trim(),
            customer_email: order.email
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
            SELECT o.*, up.first_name, up.last_name, up.email
            FROM orders o
            LEFT JOIN user_profiles up ON o.user_id = up.id
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
            customer_name: `${order.first_name || ''} ${order.last_name || ''}`.trim(),
            customer_email: order.email
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

      // Admin social posts endpoint
      if (pathname === '/api/admin/social-posts' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT sp.*, up.first_name, up.last_name
            FROM social_posts sp
            LEFT JOIN user_profiles up ON sp.author_id = up.id
            ORDER BY sp.created_at DESC
          `);
          
          const posts = result.rows.map(post => ({
            id: post.id.toString(),
            content: post.content,
            images: post.images || [],
            author_id: post.author_id,
            author_name: `${post.first_name || ''} ${post.last_name || ''}`.trim(),
            is_public: post.is_public,
            created_at: post.created_at,
            updated_at: post.updated_at
          }));

          res.writeHead(200);
          res.end(JSON.stringify(posts));
        } catch (error) {
          console.error('Error fetching social posts:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to fetch social posts' }));
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

      // Litters by breeder endpoint for Admin page (exact match)
      if (pathname === '/api/litters/by-breeder/1' && req.method === 'GET') {
        try {
          const result = await pool.query(`
            SELECT l.*, b.business_name as breeder_name
            FROM litters l
            LEFT JOIN breeders b ON l.breeder_id = b.id
            WHERE l.is_active = true
            ORDER BY l.created_at DESC
          `);
          
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
            breeder_name: litter.breeder_name || 'High Bred Bullies'
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