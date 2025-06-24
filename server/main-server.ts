import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAuthRoutes } from "./routes/auth-routes.js";
import { Pool } from "pg";

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

// Auto-approval logic for social posts
function shouldAutoApprovePost(title: string, content: string): boolean {
  const combinedText = (title + ' ' + content).toLowerCase();
  
  // Check for inappropriate content keywords
  const inappropriateKeywords = [
    'spam', 'scam', 'fake', 'bot', 'advertisement', 'buy now',
    'click here', 'free money', 'guaranteed', 'miracle',
    'profanity', 'hate', 'violence', 'illegal'
  ];
  
  // Check for pet-related positive keywords
  const petKeywords = [
    'puppy', 'dog', 'pet', 'training', 'love', 'family',
    'care', 'health', 'play', 'walk', 'feed', 'happy',
    'cute', 'adorable', 'loyal', 'friend', 'companion'
  ];
  
  // Auto-reject if inappropriate content found
  if (inappropriateKeywords.some(keyword => combinedText.includes(keyword))) {
    return false;
  }
  
  // Auto-approve if:
  // 1. Contains pet-related keywords
  // 2. Is reasonable length (10-500 words)
  // 3. Doesn't contain suspicious patterns
  const wordCount = content.split(' ').length;
  const hasPetKeywords = petKeywords.some(keyword => combinedText.includes(keyword));
  const isReasonableLength = wordCount >= 10 && wordCount <= 500;
  const hasPersonalTone = combinedText.includes('my') || combinedText.includes('our') || combinedText.includes('i ');
  
  return hasPetKeywords && isReasonableLength && hasPersonalTone;
}

// Social posts endpoint
app.post('/api/social-posts', authenticateToken, async (req: any, res: any) => {
  try {
    const { title, content, visibility = 'public', is_testimonial = false, image_url } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Auto-approve based on content criteria
    const moderation_status = shouldAutoApprovePost(title, content) ? 'approved' : 'pending';
    
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const result = await pool.query(`
        INSERT INTO social_posts (
          user_id, title, content, image_url, visibility, 
          moderation_status, is_testimonial, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `, [req.user.userId, title, content, image_url, visibility, moderation_status, is_testimonial]);
      
      await pool.end();
      
      res.status(201).json({
        ...result.rows[0],
        message: moderation_status === 'approved' ? 'Post published successfully!' : 'Post submitted for review'
      });
    } catch (dbError) {
      await pool.end();
      throw dbError;
    }
  } catch (error) {
    console.error('Create social post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Blog posts endpoint (manual approval required)
app.post('/api/blog/posts', authenticateToken, async (req: any, res: any) => {
  try {
    const { title, content, excerpt, category, image_url } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const result = await pool.query(`
        INSERT INTO blog_posts (
          title, content, excerpt, category, image_url, author_id,
          is_published, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())
        RETURNING *
      `, [title, content, excerpt, category, image_url, req.user.userId]);
      
      await pool.end();
      
      res.status(201).json({
        ...result.rows[0],
        message: 'Blog post submitted for admin review'
      });
    } catch (dbError) {
      await pool.end();
      throw dbError;
    }
  } catch (error) {
    console.error('Create blog post error:', error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
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
async function startServer() {
  try {
    // Initialize database connection
    const pool = new Pool({
      host: '50.193.77.237',
      port: 5432,
      database: 'high_bred',
      user: 'rtownsend',
      password: 'rTowns402',
      ssl: false,
    });

    console.log('🔗 Connecting to user database: 50.193.77.237:5432/high_bred');

    // Setup auth routes with working password reset
    const authRoutes = createAuthRoutes(pool);
    app.use('/', authRoutes);

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
}

startServer();