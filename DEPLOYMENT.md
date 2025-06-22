
# Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env.local` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. Start development server: `npm run dev`

## Docker Development

### Using Docker Compose (Recommended)
```bash
# Development environment
docker-compose -f docker-compose.dev.yml up

# Production environment
docker-compose up
```

### Using Docker directly
```bash
# Build the image
docker build -t high-bred-bullies .

# Run the container
docker run -p 3000:80 high-bred-bullies
```

## Production Deployment

### Environment Variables
Set these environment variables in your production environment:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Deployment Options

#### 1. Lovable Platform (Recommended)
- Use the built-in Lovable deployment via the "Publish" button
- Supports custom domains on paid plans

#### 2. Vercel
```bash
npm install -g vercel
vercel
```

#### 3. Netlify
```bash
npm run build
# Upload dist/ folder to Netlify
```

#### 4. Docker (VPS/Cloud)
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and push to container registry
docker build -t your-registry/high-bred-bullies .
docker push your-registry/high-bred-bullies
```

#### 5. Static Hosting (AWS S3, CloudFront, etc.)
```bash
npm run build
# Upload dist/ folder to your static hosting service
```

## Database Setup

This project uses Supabase as the backend. Make sure to:
1. Create a Supabase project
2. Run the migrations from the `supabase/migrations/` folder
3. Set up the required secrets in your Supabase project
4. Configure Row Level Security (RLS) policies

## Monitoring & Maintenance

- Monitor application logs
- Set up health checks on port 80 (production) or 5173 (development)
- Regularly update dependencies
- Monitor Supabase usage and performance
