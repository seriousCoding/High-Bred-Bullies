import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupViteMiddleware(app) {
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: path.resolve(__dirname, '..'),
    configFile: path.resolve(__dirname, '..', 'vite.config.ts'),
  });

  // Use vite's connect instance as middleware - but only for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    vite.middlewares(req, res, next);
  });

  return vite;
}