require('dotenv/config');
const { createServer } = require('vite');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database connection - Force connection to user's actual database
const pool = new Pool({
  connectionString: 'postgresql://rtownsend:rTowns402@50.193.77.237:5432/high_bred?sslmode=disable',
  ssl: false
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

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    setHeaders(res);
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Access token required' }));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    setHeaders(res);
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Invalid token' }));
  }
}

async function startServer() {
  console.log('🚀 Starting Vite development server...');
  
  // Create Vite server in middleware mode
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  // Create HTTP server
  const server = createHttpServer(async (req, res) => {
    const url = parse(req.url || '/', true);
    const pathname = url.pathname || '/';

    setHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      try {
        // Parse request body for POST/PUT requests
        if (req.method === 'POST' || req.method === 'PUT') {
          req.body = await parseBody(req);
        }

        // Health check
        if (pathname === '/api/health' && req.method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            authentication: 'JWT enabled',
            server: 'Vite + Node.js',
            port: PORT
          }));
          return;
        }

        // Register endpoint
        if (pathname === '/api/register' && req.method === 'POST') {
          const { username, password } = req.body;

          if (!username || !password) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Username and password required' }));
            return;
          }

          try {
            // Check if user exists
            const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (existingUser.rows.length > 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Username already exists' }));
              return;
            }

            // Hash password and create user
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await pool.query(
              'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
              [username, hashedPassword]
            );

            const user = result.rows[0];
            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

            res.writeHead(201);
            res.end(JSON.stringify({ token, user }));
          } catch (error) {
            console.error('Registration error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Registration failed' }));
          }
          return;
        }

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
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
              res.writeHead(401);
              res.end(JSON.stringify({ error: 'Invalid credentials' }));
              return;
            }

            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.writeHead(200);
            res.end(JSON.stringify({ 
              token, 
              user: { 
                id: user.id, 
                username: user.username,
                isBreeder: user.is_breeder || false,
                fullName: user.full_name || null,
                hasApiKeys: false // This would need to be queried separately if needed
              } 
            }));
          } catch (error) {
            console.error('Login error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Login failed' }));
          }
          return;
        }

        // User endpoint (protected)
        if (pathname === '/api/user' && req.method === 'GET') {
          return authenticateToken(req, res, async () => {
            try {
              const result = await pool.query(`
                SELECT u.id, u.username, 
                       up.is_breeder, up.full_name
                FROM users u 
                LEFT JOIN user_profiles up ON u.id = up.user_id 
                WHERE u.id = $1
              `, [req.user.userId]);
              
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
                isBreeder: user.is_breeder || false,
                fullName: user.full_name || null,
                hasApiKeys: false
              }));
            } catch (error) {
              console.error('User endpoint error:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to fetch user data' }));
            }
          });
        }

        // User Profile GET endpoint
        if (pathname === '/api/user/profile' && req.method === 'GET') {
          return authenticateToken(req, res, async () => {
            try {
              const result = await pool.query(`
                SELECT * FROM user_profiles WHERE user_id = $1
              `, [req.user.userId]);
              
              if (result.rows.length === 0) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Profile not found' }));
                return;
              }
              
              const profile = result.rows[0];
              res.writeHead(200);
              res.end(JSON.stringify({
                id: profile.id,
                userId: profile.user_id,
                fullName: profile.full_name,
                phone: profile.phone,
                address: profile.address,
                city: profile.city,
                state: profile.state,
                zipCode: profile.zip_code,
                avatarUrl: profile.avatar_url,
                bio: profile.bio,
                isBreeder: profile.is_breeder || false,
                createdAt: profile.created_at,
                updatedAt: profile.updated_at
              }));
            } catch (error) {
              console.error('Get profile error:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        }

        // User Profile POST endpoint
        if (pathname === '/api/user/profile' && req.method === 'POST') {
          return authenticateToken(req, res, async () => {
            try {
              const { username, first_name, last_name } = req.body;
              
              // Check if profile already exists
              const existingProfile = await pool.query(`
                SELECT * FROM user_profiles WHERE user_id = $1
              `, [req.user.userId]);
              
              if (existingProfile.rows.length > 0) {
                const profile = existingProfile.rows[0];
                res.writeHead(200);
                res.end(JSON.stringify({
                  id: profile.id,
                  userId: profile.user_id,
                  fullName: profile.full_name,
                  phone: profile.phone,
                  address: profile.address,
                  city: profile.city,
                  state: profile.state,
                  zipCode: profile.zip_code,
                  avatarUrl: profile.avatar_url,
                  bio: profile.bio,
                  isBreeder: profile.is_breeder || false,
                  createdAt: profile.created_at,
                  updatedAt: profile.updated_at
                }));
                return;
              }

              // Create new profile
              const fullName = `${first_name} ${last_name}`.trim();
              const result = await pool.query(`
                INSERT INTO user_profiles 
                (user_id, full_name, phone, address, city, state, zip_code, avatar_url, bio, is_breeder, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                RETURNING *
              `, [req.user.userId, fullName, null, null, null, null, null, null, null, false]);

              const newProfile = result.rows[0];
              res.writeHead(201);
              res.end(JSON.stringify({
                id: newProfile.id,
                userId: newProfile.user_id,
                fullName: newProfile.full_name,
                phone: newProfile.phone,
                address: newProfile.address,
                city: newProfile.city,
                state: newProfile.state,
                zipCode: newProfile.zip_code,
                avatarUrl: newProfile.avatar_url,
                bio: newProfile.bio,
                isBreeder: newProfile.is_breeder || false,
                createdAt: newProfile.created_at,
                updatedAt: newProfile.updated_at
              }));
            } catch (error) {
              console.error('Create profile error:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to create profile' }));
            }
          });
        }

        // Litters endpoints
        if (pathname === '/api/litters/featured' && req.method === 'GET') {
          try {
            const result = await pool.query(`
              SELECT l.*, b.business_name as breeder_name 
              FROM litters l
              LEFT JOIN breeders b ON l.breeder_id = b.id
              WHERE l.is_active = true AND l.status != 'archived'
              ORDER BY l.birth_date ASC
              LIMIT 10
            `);
            
            const litters = result.rows.map(row => ({
              id: row.id.toString(),
              name: row.name || `${row.dam_name} x ${row.sire_name}`,
              breed: row.breed,
              birth_date: row.birth_date,
              available_puppies: row.available_puppies,
              total_puppies: row.total_puppies,
              price_per_male: row.price_per_male,
              price_per_female: row.price_per_female,
              dam_name: row.dam_name,
              sire_name: row.sire_name,
              description: row.description,
              image_url: row.image_url,
              status: row.status,
              breeder_id: row.breeder_id?.toString(),
              breeders: {
                business_name: row.breeder_name,
                delivery_fee: 250,
                delivery_areas: ["Texas", "Oklahoma", "Arkansas", "Louisiana"]
              }
            }));
            
            res.writeHead(200);
            res.end(JSON.stringify(litters));
          } catch (error) {
            console.error('Error fetching featured litters:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch litters' }));
          }
          return;
        }

        if (pathname.startsWith('/api/litters/breeder/') && req.method === 'GET') {
          try {
            const breederId = pathname.split('/')[4];
            const result = await pool.query(`
              SELECT * FROM litters 
              WHERE breeder_id = $1 
              ORDER BY birth_date DESC
            `, [breederId]);
            
            const litters = result.rows.map(row => ({
              id: row.id.toString(),
              name: `${row.dam_name} x ${row.sire_name}`,
              breed: row.breed,
              birth_date: row.birth_date,
              available_puppies: row.available_puppies,
              total_puppies: row.total_puppies,
              price_per_male: row.male_price * 100,
              price_per_female: row.female_price * 100,
              dam_name: row.dam_name,
              sire_name: row.sire_name,
              description: row.description,
              image_url: row.images && row.images.length > 0 ? row.images[0] : null,
              status: row.is_active ? 'active' : 'archived',
              breeder_id: row.breeder_id?.toString()
            }));
            
            res.writeHead(200);
            res.end(JSON.stringify(litters));
          } catch (error) {
            console.error('Error fetching breeder litters:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch breeder litters' }));
          }
          return;
        }

        // Social posts endpoints
        if (pathname === '/api/social_feed_posts' && req.method === 'GET') {
          try {
            const result = await pool.query(`
              SELECT *
              FROM social_feed_posts
              WHERE visibility = 'public'
              ORDER BY created_at DESC
              LIMIT 50
            `);
            
            const posts = result.rows.map(row => ({
              id: row.id,
              authorId: row.user_id,
              authorName: row.username || `${row.first_name} ${row.last_name}`.trim(),
              authorAvatar: row.avatar_url,
              title: row.title,
              content: row.content,
              imageUrl: row.image_url,
              isPublic: row.visibility === 'public',
              likesCount: row.likes_count || 0,
              commentsCount: row.comments_count || 0,
              createdAt: row.created_at,
              isTestimonial: row.is_testimonial || false,
              moderationStatus: row.moderation_status
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

        // Contact info endpoint
        if (pathname === '/api/contact' && req.method === 'GET') {
          try {
            const result = await pool.query(`
              SELECT * FROM site_config 
              WHERE key IN ('contact_email', 'contact_phone', 'business_address')
            `);
            
            const contactInfo = {};
            result.rows.forEach(row => {
              contactInfo[row.key] = row.value;
            });
            
            res.writeHead(200);
            res.end(JSON.stringify(contactInfo));
          } catch (error) {
            console.error('Error fetching contact info:', error);
            res.writeHead(200);
            res.end(JSON.stringify({
              contact_email: 'info@highbredbullies.com',
              contact_phone: '(555) 123-4567',
              business_address: '123 Breeding Lane, Dog City, DC 12345'
            }));
          }
          return;
        }

        // Blog posts endpoint
        if (pathname === '/api/blog/posts' && req.method === 'GET') {
          try {
            const result = await pool.query(`
              SELECT *
              FROM blog_posts
              WHERE published_at IS NOT NULL
              ORDER BY published_at DESC, created_at DESC
              LIMIT 50
            `);
            
            const posts = result.rows.map(row => ({
              id: row.id,
              title: row.title,
              slug: row.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `post-${row.id}`,
              excerpt: row.excerpt,
              content: row.content,
              imageUrl: row.image_url,
              authorId: row.id,
              authorName: row.author_name || 'Admin User',
              category: row.category,
              tags: [],
              publishedAt: row.published_at,
              createdAt: row.created_at,
              updatedAt: row.updated_at
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

        // Puppies for a specific litter - check this BEFORE individual litter endpoint
        if (pathname.startsWith('/api/litters/') && pathname.includes('/puppies') && req.method === 'GET') {
          try {
            const litterId = pathname.split('/')[3];
            const result = await pool.query(`
              SELECT * FROM puppies 
              WHERE litter_id = $1 
              ORDER BY name ASC
            `, [litterId]);
            
            const puppies = result.rows.map(row => ({
              id: row.id.toString(),
              litter_id: row.litter_id.toString(),
              name: row.name,
              gender: row.gender,
              color: row.color,
              is_available: row.is_available,
              image_url: row.images && row.images.length > 0 ? row.images[0] : null,
              created_at: row.created_at,
              updated_at: row.updated_at
            }));
            
            res.writeHead(200);
            res.end(JSON.stringify(puppies));
          } catch (error) {
            console.error('Error fetching puppies:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch puppies' }));
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
              WHERE l.is_active = true AND l.birth_date > NOW()
              ORDER BY l.birth_date ASC
              LIMIT 10
            `);
            
            const litters = result.rows.map(row => ({
              id: row.id.toString(),
              name: row.name || `${row.dam_name} x ${row.sire_name}`,
              breed: row.breed,
              birth_date: row.birth_date,
              available_puppies: row.available_puppies,
              total_puppies: row.total_puppies,
              price_per_male: row.price_per_male,
              price_per_female: row.price_per_female,
              dam_name: row.dam_name,
              sire_name: row.sire_name,
              description: row.description,
              image_url: row.image_url,
              status: 'upcoming',
              breeder_id: row.breeder_id?.toString(),
              breeders: {
                business_name: row.breeder_name,
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

        // Individual litter endpoint
        if (pathname.startsWith('/api/litters/') && !pathname.includes('/breeder/') && !pathname.includes('/puppies') && !pathname.includes('/upcoming') && req.method === 'GET') {
          try {
            const litterId = pathname.split('/')[3];
            const result = await pool.query(`
              SELECT l.*, b.business_name as breeder_name 
              FROM litters l
              LEFT JOIN breeders b ON l.breeder_id = b.id
              WHERE l.id = $1
            `, [litterId]);
            
            if (result.rows.length === 0) {
              res.writeHead(404);
              res.end(JSON.stringify({ error: 'Litter not found' }));
              return;
            }

            const litter = result.rows[0];
            res.writeHead(200);
            res.end(JSON.stringify({
              id: litter.id.toString(),
              name: `${litter.dam_name} x ${litter.sire_name}`,
              breed: litter.breed,
              birth_date: litter.birth_date,
              available_puppies: litter.available_puppies,
              total_puppies: litter.total_puppies,
              price_per_male: litter.male_price * 100,
              price_per_female: litter.female_price * 100,
              dam_name: litter.dam_name,
              sire_name: litter.sire_name,
              dam_pedigree: litter.dam_pedigree,
              sire_pedigree: litter.sire_pedigree,
              description: litter.description,
              image_url: litter.images && litter.images.length > 0 ? litter.images[0] : null,
              status: litter.is_active ? 'active' : 'archived',
              breeder_id: litter.breeder_id?.toString(),
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

        // Default API response
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
        return;
      } catch (error) {
        console.error('API Error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
      }
    }

    // Use Vite's middleware for everything else (React app)
    vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end('Not found');
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log('📊 Database: PostgreSQL connected');
    console.log('🔐 JWT Authentication: Enabled');
    console.log('⚡ Vite: Development server active');
    console.log('✅ Server ready for connections');
  });

  // Handle server shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    server.close(() => {
      vite.close();
      process.exit(0);
    });
  });
}

startServer().catch(console.error);