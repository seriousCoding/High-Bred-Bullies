# High Bred Bullies - Production Deployment Guide

## Overview
This guide covers deploying the High Bred Bullies dog breeding platform to production environments using Docker containerization with Nginx reverse proxy.

## Prerequisites

### Required Environment Variables
Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database
PGHOST=your_db_host
PGPORT=5432
PGUSER=your_db_user
PGPASSWORD=your_db_password
PGDATABASE=your_db_name

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_key_here

# Email Service (SMTP)
SMTP_HOST=mail.yourprovider.com
SMTP_PORT=587
SMTP_USER=your_email@yourdomain.com
SMTP_PASS=your_email_password
SMTP_FROM=High Bred Bullies <noreply@yourdomain.com>

# Payment Processing (Optional - for Stripe integration)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
VITE_STRIPE_PUBLIC_KEY=pk_live_your_stripe_publishable_key

# AI Content Generation (Optional - for OpenAI features)
OPENAI_API_KEY=sk-your_openai_api_key

# Application Configuration
NODE_ENV=production
PORT=5000
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Build and Start Services**
```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up -d
```

2. **View Logs**
```bash
docker-compose logs -f app
```

3. **Stop Services**
```bash
docker-compose down
```

### Option 2: Manual Docker Build

1. **Build the Application**
```bash
docker build -t high-bred-bullies .
```

2. **Run the Container**
```bash
docker run -d \
  --name high-bred-bullies \
  -p 80:80 \
  --env-file .env \
  high-bred-bullies
```

### Option 3: Replit Deployment

1. **Configure Secrets**
   - Add all environment variables to Replit Secrets
   - Ensure database connection string is properly formatted

2. **Deploy**
   - Use Replit's autoscale deployment feature
   - Application will be available at your-repl-name.your-username.repl.co

## Database Setup

### Initial Migration
The application will automatically create necessary tables on first startup. Ensure your PostgreSQL database is accessible and the user has CREATE permissions.

### Required Database Tables
The application expects the following core tables:
- `users` - User authentication and profiles
- `user_profiles` - Extended user information
- `breeders` - Breeder-specific data
- `litters` - Breeding litter information
- `puppies` - Individual puppy records
- `orders` - Purchase orders
- `blog_posts` - Content management
- `social_posts` - Community features

## SSL/TLS Configuration

### Nginx SSL Setup (Production)
The included `nginx.conf` supports SSL termination. To enable HTTPS:

1. **Obtain SSL Certificates**
```bash
# Using Let's Encrypt (recommended)
certbot --nginx -d yourdomain.com
```

2. **Update nginx.conf**
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    # ... rest of configuration
}
```

## Performance Optimization

### Application-Level Optimizations
- Static assets are served by Nginx with proper caching headers
- Database connection pooling is configured for optimal performance
- JWT tokens include proper expiration times
- API responses include appropriate cache-control headers

### Database Optimizations
- Ensure proper indexes on frequently queried columns
- Regular VACUUM and ANALYZE operations for PostgreSQL
- Connection pooling configured with reasonable limits

## Monitoring and Logging

### Application Logs
```bash
# View application logs
docker-compose logs -f app

# View nginx logs
docker-compose logs -f nginx
```

### Health Checks
The application includes a health check endpoint:
```bash
curl http://localhost/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-01-23T12:00:00.000Z"
}
```

## Backup Strategy

### Database Backups
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql $DATABASE_URL < backup_file.sql
```

### File System Backups
Important directories to backup:
- Application logs
- SSL certificates
- Environment configuration files

## Security Considerations

### Network Security
- Application runs behind Nginx reverse proxy
- All sensitive routes require authentication
- CORS properly configured for production domains
- Rate limiting configured in Nginx

### Data Security
- JWT tokens use strong secrets
- Passwords hashed with bcryptjs
- Database connections use SSL when available
- Environment variables properly secured

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
```bash
# Check database connectivity
docker-compose exec app node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => console.log('DB OK:', r.rows[0])).catch(console.error);
"
```

2. **Authentication Issues**
- Verify JWT_SECRET is properly set
- Check token expiration times
- Ensure user records exist in database

3. **Email Delivery Problems**
- Verify SMTP credentials
- Check firewall rules for SMTP ports
- Test email configuration with simple send

### Log Analysis
```bash
# Search for errors
docker-compose logs app | grep -i error

# Monitor real-time logs
docker-compose logs -f --tail=100 app
```

## Scaling Considerations

### Horizontal Scaling
- Application is stateless and can be horizontally scaled
- Use a load balancer to distribute traffic across instances
- Ensure database can handle increased connection load

### Database Scaling
- Implement read replicas for read-heavy workloads
- Consider connection pooling solutions like PgBouncer
- Monitor query performance and optimize as needed

## Support and Maintenance

### Regular Maintenance Tasks
- Update dependencies regularly
- Monitor disk space and database size
- Review and rotate log files
- Update SSL certificates before expiration

### Performance Monitoring
- Monitor response times for critical endpoints
- Track database query performance
- Monitor memory and CPU usage
- Set up alerts for system health

## Environment-Specific Notes

### Development
- Hot reload enabled with Vite development server
- Detailed error messages and stack traces
- Mock Stripe integration for testing purchases

### Production
- Optimized builds with asset compression
- Error logging without sensitive information
- Real payment processing integration
- Proper SSL termination and security headers

---

For additional support or questions about deployment, refer to the project documentation or contact the development team.