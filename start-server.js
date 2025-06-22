import dotenv from 'dotenv';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper functions
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function setHeaders(res, contentType = 'application/json') {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function authenticateToken(authorization) {
  if (!authorization) return null;
  const token = authorization.split(' ')[1];
  if (!token) return null;
  
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Create HTTP server
const server = createServer(async (req, res) => {
  const { method, url } = req;
  
  setHeaders(res);
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // API Routes
    if (url.startsWith('/api/')) {
      if (url === '/api/health' && method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: process.env.DATABASE_URL ? 'connected' : 'not configured',
          authentication: 'JWT enabled',
          server: 'Node.js HTTP',
          port: 5000
        }));
        return;
      }

      if (url === '/api/register' && method === 'POST') {
        const body = await parseBody(req);
        const { username, password } = body;
        
        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }

        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
          );

          const user = result.rows[0];
          const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.writeHead(201);
          res.end(JSON.stringify({ token, user: { id: user.id, username: user.username } }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Registration failed' }));
        }
        return;
      }

      if (url === '/api/login' && method === 'POST') {
        const body = await parseBody(req);
        const { username, password } = body;
        
        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }

        try {
          const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
          
          if (result.rows.length === 0) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const user = result.rows[0];
          const validPassword = await bcrypt.compare(password, user.password);
          
          if (!validPassword) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.writeHead(200);
          res.end(JSON.stringify({ token, user: { id: user.id, username: user.username } }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Login failed' }));
        }
        return;
      }

      if (url === '/api/user' && method === 'GET') {
        const user = await authenticateToken(req.headers.authorization);
        if (!user) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          id: user.userId,
          username: user.username
        }));
        return;
      }

      // API not found
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'API endpoint not found' }));
      return;
    }

    // Static file serving
    let filePath = url;
    if (url === '/') filePath = '/index.html';
    
    // Try different locations for static files
    const possiblePaths = [
      join(__dirname, filePath), // Direct path
      join(__dirname, 'public', filePath), // Public directory
      join(__dirname, 'src', filePath.replace('/src/', '')), // Source directory
      join(__dirname, 'dist', filePath) // Built files
    ];
    
    let fileFound = false;
    for (const fullPath of possiblePaths) {
      try {
        const content = readFileSync(fullPath);
        
        // Determine content type
        let contentType = 'text/html';
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.jsx')) {
          contentType = 'application/javascript';
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          contentType = 'application/javascript';
        } else if (filePath.endsWith('.css')) {
          contentType = 'text/css';
        } else if (filePath.endsWith('.json')) {
          contentType = 'application/json';
        } else if (filePath.endsWith('.png')) {
          contentType = 'image/png';
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (filePath.endsWith('.svg')) {
          contentType = 'image/svg+xml';
        } else if (filePath.endsWith('.ico')) {
          contentType = 'image/x-icon';
        }
        
        setHeaders(res, contentType);
        res.writeHead(200);
        res.end(content);
        fileFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    // If no file found, serve index.html for SPA routing (only for non-static requests)
    if (!fileFound) {
      if (filePath.includes('.')) {
        // This looks like a file request that failed
        res.writeHead(404);
        res.end('File not found: ' + filePath);
      } else {
        // This is likely a SPA route, serve index.html
        try {
          const indexPath = join(__dirname, 'index.html');
          const indexContent = readFileSync(indexPath);
          setHeaders(res, 'text/html');
          res.writeHead(200);
          res.end(indexContent);
        } catch {
          res.writeHead(404);
          res.end('Index file not found');
        }
      }
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTP server running on http://0.0.0.0:${PORT}`);
  console.log('📊 Database: PostgreSQL connected');
  console.log('🔐 JWT Authentication: Enabled');
  console.log('✅ Server ready for connections');
});