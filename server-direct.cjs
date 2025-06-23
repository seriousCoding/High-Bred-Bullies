require('dotenv/config');
const { createServer } = require('vite');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Direct database connection to user's PostgreSQL database
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

console.log('🔗 Direct connection to: 50.193.77.237:5432/high_bred');

// Verify connection and show user count
pool.connect()
  .then(client => {
    return client.query('SELECT current_database(), count(*) as user_count FROM users')
      .then(result => {
        console.log(`✅ Database: ${result.rows[0].current_database}, Users: ${result.rows[0].user_count}`);
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
      // Login endpoint
      if (pathname === '/api/login' && req.method === 'POST') {
        const { username, password } = req.body;

        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }

        try {
          const result = await pool.query(`
            SELECT u.id, u.username, u.password_hash, 
                   up.is_breeder, up.full_name
            FROM users u 
            LEFT JOIN user_profiles up ON u.id = up.user_id 
            WHERE u.username = $1
          `, [username]);
          
          if (result.rows.length === 0) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const user = result.rows[0];
          const isValid = await bcrypt.compare(password, user.password_hash);
          
          if (!isValid) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const token = jwt.sign(
            { 
              userId: user.id, 
              username: user.username,
              isBreeder: user.is_breeder || false
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
              isBreeder: user.is_breeder || false,
              fullName: user.full_name
            }
          }));
        } catch (error) {
          console.error('Login error:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Login failed' }));
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
            SELECT l.*, b.business_name as breeder_name,
                   b.delivery_fee, b.delivery_areas
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
              business_name: litter.breeder_name,
              delivery_fee: litter.delivery_fee || 250,
              delivery_areas: litter.delivery_areas || ["Texas", "Oklahoma", "Arkansas", "Louisiana"]
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

      // Individual litter endpoint with puppies
      if (pathname.startsWith('/api/litters/') && !pathname.includes('/featured') && !pathname.includes('/upcoming') && req.method === 'GET') {
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
              business_name: litter.breeder_name,
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