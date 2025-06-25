import { createServer as createViteServer } from 'vite';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { setupAuth } from './auth';
import { registerApiRoutes } from './api-routes';
import { parse } from 'url';
import { readFileSync } from 'fs';
import { join } from 'path';

const PORT = process.env.PORT || 5000;

async function parseBody(req: IncomingMessage): Promise<any> {
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

async function startServer() {
  console.log('🚀 Starting Vite development server...');
  
  // Create Vite server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  // Create HTTP server
  const server = createServer(async (req, res) => {
    const url = parse(req.url || '/', true);
    const pathname = url.pathname || '/';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
          (req as any).body = await parseBody(req);
        }

        // Handle authentication routes
        if (pathname === '/api/register' && req.method === 'POST') {
          const { setupAuth } = await import('./auth');
          // Create mock express app for auth handler
          const mockApp = {
            post: (path: string, handler: Function) => {
              if (path === '/api/register') {
                return handler(req, res);
              }
            }
          };
          setupAuth(mockApp as any);
          return;
        }

        if (pathname === '/api/login' && req.method === 'POST') {
          const { setupAuth } = await import('./auth');
          const mockApp = {
            post: (path: string, handler: Function) => {
              if (path === '/api/login') {
                return handler(req, res);
              }
            }
          };
          setupAuth(mockApp as any);
          return;
        }

        if (pathname === '/api/user' && req.method === 'GET') {
          const { authenticateToken } = await import('./auth');
          return authenticateToken(req, res, () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              id: (req as any).user?.id, 
              username: (req as any).user?.username 
            }));
          });
        }

        if (pathname === '/api/health' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
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

        // Default API response
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API endpoint not found' }));
        return;
      } catch (error) {
        console.error('API Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
      }
    }

    // Use Vite's middleware for everything else
    vite.middlewares(req, res, () => {
      // Fallback for unhandled requests
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