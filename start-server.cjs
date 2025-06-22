require('dotenv/config');
const { createServer } = require('vite');
const { createServer: createHttpServer } = require('http');
const { parse } = require('url');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

        // Featured litters endpoint (stub for the breeding app)
        if (pathname === '/api/litters/featured' && req.method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify([]));
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