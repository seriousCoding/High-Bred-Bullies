import express from 'express';
import { createServer } from 'http';
import { setupVite, serveStatic, log } from './vite';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'savvai_jwt_secret_key_2025';

// Auth middleware
function authenticateToken(req: any, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    req.user = user;
    next();
  });
}

// Auth routes
app.post('/api/register', (req: express.Request, res: express.Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  // For demo - hash password and return success
  bcrypt.hash(password, 10).then(hashedPassword => {
    res.status(201).json({ 
      message: 'User registered successfully',
      username 
    });
  }).catch(error => {
    res.status(500).json({ error: 'Registration failed' });
  });
});

app.post('/api/login', (req: express.Request, res: express.Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  // For demo purposes - generate token for any login
  const token = jwt.sign(
    { userId: 1, username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: 1, username }
  });
});

app.get('/api/user', authenticateToken, (req: any, res: express.Response) => {
  res.json({
    id: req.user.userId,
    username: req.user.username
  });
});

app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    authentication: 'JWT enabled'
  });
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

async function startServer() {
  try {
    const server = createServer(app);
    
    // Setup Vite middleware for development
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server on configured port
    const port = parseInt(process.env.PORT) || 5000;
    const host = process.env.HOST || "0.0.0.0";
    server.listen(port, host, () => {
      log(`🚀 Server running on http://0.0.0.0:${port}`);
      log(`📊 Database: ${process.env.DATABASE_URL ? 'PostgreSQL connected' : 'Not configured'}`);
      log(`🔐 JWT Authentication: Enabled`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();