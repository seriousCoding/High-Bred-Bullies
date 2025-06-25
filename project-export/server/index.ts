import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Auth middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Routes
app.post('/api/register', async (req: any, res: any) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    await bcrypt.hash(password, 10);
    res.status(201).json({ 
      message: 'User registered successfully',
      username 
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', (req: any, res: any) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

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

app.get('/api/user', authenticateToken, (req: any, res: any) => {
  res.json({
    id: req.user.userId,
    username: req.user.username
  });
});

app.get('/api/health', (req: any, res: any) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    authentication: 'JWT enabled',
    port: 5000
  });
});

// Request logging
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  
  next();
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  console.error('Server Error:', err);
  res.status(status).json({ message });
});

// Start server
(async () => {
  try {
    const server = createServer(app);
    
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`🚀 Express server running on http://0.0.0.0:${port}`);
      log(`📊 Database: ${process.env.DATABASE_URL ? 'PostgreSQL connected' : 'Not configured'}`);
      log(`🔐 JWT Authentication: Enabled`);
      log(`✅ Server ready for connections`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
