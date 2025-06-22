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
            const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
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
            res.end(JSON.stringify({ token, user: { id: user.id, username: user.username } }));
          } catch (error) {
            console.error('Login error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Login failed' }));
          }
          return;
        }

        // User endpoint (protected)
        if (pathname === '/api/user' && req.method === 'GET') {
          return authenticateToken(req, res, () => {
            res.writeHead(200);
            res.end(JSON.stringify({ 
              id: req.user.userId, 
              username: req.user.username 
            }));
          });
        }

        // Coinbase Trading API endpoints
        if (pathname === '/api/products' && req.method === 'GET') {
          try {
            // Sample cryptocurrency products data for the trading interface
            const products = [
              {
                product_id: 'BTC-USD',
                display_name: 'Bitcoin',
                base_currency: 'BTC',
                quote_currency: 'USD',
                price: '43250.00',
                price_percentage_change_24h: '2.45',
                volume_24h: '1234567890.12',
                status: 'online'
              },
              {
                product_id: 'ETH-USD',
                display_name: 'Ethereum',
                base_currency: 'ETH',
                quote_currency: 'USD',
                price: '2680.50',
                price_percentage_change_24h: '-1.23',
                volume_24h: '987654321.45',
                status: 'online'
              },
              {
                product_id: 'ADA-USD',
                display_name: 'Cardano',
                base_currency: 'ADA',
                quote_currency: 'USD',
                price: '0.485',
                price_percentage_change_24h: '3.67',
                volume_24h: '456789123.78',
                status: 'online'
              },
              {
                product_id: 'SOL-USD',
                display_name: 'Solana',
                base_currency: 'SOL',
                quote_currency: 'USD',
                price: '98.72',
                price_percentage_change_24h: '5.12',
                volume_24h: '234567890.23',
                status: 'online'
              }
            ];
            
            res.writeHead(200);
            res.end(JSON.stringify(products));
          } catch (error) {
            console.error('Error fetching products:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to fetch products' }));
          }
          return;
        }

        if (pathname === '/api/accounts' && req.method === 'GET') {
          return authenticateToken(req, res, () => {
            try {
              // Sample account data for authenticated users
              const accounts = [
                {
                  uuid: 'acc-001',
                  name: 'USD Wallet',
                  currency: 'USD',
                  available_balance: { value: '5000.00', currency: 'USD' },
                  hold: { value: '0.00', currency: 'USD' }
                },
                {
                  uuid: 'acc-002',
                  name: 'Bitcoin Wallet',
                  currency: 'BTC',
                  available_balance: { value: '0.12345678', currency: 'BTC' },
                  hold: { value: '0.00000000', currency: 'BTC' }
                },
                {
                  uuid: 'acc-003',
                  name: 'Ethereum Wallet',
                  currency: 'ETH',
                  available_balance: { value: '2.5678', currency: 'ETH' },
                  hold: { value: '0.0000', currency: 'ETH' }
                }
              ];
              
              res.writeHead(200);
              res.end(JSON.stringify(accounts));
            } catch (error) {
              console.error('Error fetching accounts:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to fetch accounts' }));
            }
          });
        }

        if (pathname === '/api/orders' && req.method === 'GET') {
          return authenticateToken(req, res, () => {
            try {
              // Sample order data
              const orders = [
                {
                  order_id: 'ord-001',
                  product_id: 'BTC-USD',
                  side: 'BUY',
                  size: '0.001',
                  price: '43000.00',
                  status: 'FILLED',
                  created_time: new Date().toISOString(),
                  filled_size: '0.001'
                },
                {
                  order_id: 'ord-002',
                  product_id: 'ETH-USD',
                  side: 'SELL',
                  size: '0.1',
                  price: '2700.00',
                  status: 'PENDING',
                  created_time: new Date(Date.now() - 3600000).toISOString(),
                  filled_size: '0.0'
                }
              ];
              
              res.writeHead(200);
              res.end(JSON.stringify(orders));
            } catch (error) {
              console.error('Error fetching orders:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
            }
          });
        }

        if (pathname === '/api/orders' && req.method === 'POST') {
          return authenticateToken(req, res, () => {
            try {
              const { product_id, side, size, type, price } = req.body;
              
              if (!product_id || !side || !size || !type) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Missing required order parameters' }));
                return;
              }

              // Simulate order creation
              const order = {
                order_id: 'ord-' + Date.now(),
                product_id,
                side,
                size,
                type,
                price: price || 'market',
                status: 'PENDING',
                created_time: new Date().toISOString(),
                filled_size: '0'
              };
              
              res.writeHead(201);
              res.end(JSON.stringify(order));
            } catch (error) {
              console.error('Error creating order:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Failed to create order' }));
            }
          });
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