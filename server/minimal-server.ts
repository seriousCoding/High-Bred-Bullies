import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { setupVite, serveStatic, log } from './vite';

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    port: 5000
  });
});

// Basic auth endpoints (simplified)
app.post('/api/register', (req, res) => {
  res.status(501).json({ message: 'Registration endpoint - implementation in progress' });
});

app.post('/api/login', (req, res) => {
  res.status(501).json({ message: 'Login endpoint - implementation in progress' });
});

app.get('/api/user', (req, res) => {
  res.status(401).json({ message: 'Authentication required' });
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

    // Start server on port 5000
    const port = 5000;
    server.listen(port, '0.0.0.0', () => {
      log(`🚀 Server running on http://0.0.0.0:${port}`);
      log(`📊 Database: ${process.env.DATABASE_URL ? 'PostgreSQL connected' : 'Not configured'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();