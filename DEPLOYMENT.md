
# Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with your database and JWT credentials:
   ```
   DATABASE_URL=your_postgresql_connection_string
   JWT_SECRET=your_jwt_secret_key
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
- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: Your JWT secret key for authentication

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

This project uses PostgreSQL with JWT authentication. Make sure to:
1. Set up a PostgreSQL database (connection via DATABASE_URL environment variable)
2. Run database migrations using `npm run db:push`
3. Configure JWT_SECRET environment variable for authentication
4. Ensure database schema is properly initialized

## Monitoring & Maintenance

- Monitor application logs
- Set up health checks on port 5000 (production/development)
- Regularly update dependencies
- Monitor PostgreSQL database performance and connections
