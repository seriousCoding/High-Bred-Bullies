# High Bred Bullies - Deployment Guide

This guide provides comprehensive instructions for deploying the High Bred Bullies dog breeding platform in production environments.

## Quick Start

```bash
# Clone and deploy
git clone <repository-url>
cd high-bred-bullies
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## Prerequisites

### System Requirements
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space
- Linux/macOS/Windows with WSL2

### External Services
- PostgreSQL database (optional with Docker Compose)
- Stripe account for payments
- SMTP server for emails
- OpenAI API key (optional)

## Environment Configuration

Create `.env` file with required variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-32-character-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_live_your_key
VITE_STRIPE_PUBLIC_KEY=pk_live_your_key

# Email
SMTP_HOST=smtp.your-provider.com
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password

# Optional
OPENAI_API_KEY=your-openai-key
```

## Deployment Methods

### Option 1: Docker Compose (Recommended)

Complete stack with database, app, and reverse proxy:

```bash
# Deploy full stack
docker-compose up -d

# View logs
docker-compose logs -f

# Scale application
docker-compose up -d --scale app=3
```

### Option 2: Docker Container Only

Use existing database:

```bash
# Build image
docker build -t high-bred-bullies .

# Run container
docker run -d \
  --name hbb-app \
  -p 5000:5000 \
  --env-file .env \
  high-bred-bullies
```

### Option 3: Cloud Platform Deployment

#### AWS ECS
- Use provided Dockerfile
- Configure ALB for load balancing
- Use RDS for PostgreSQL
- Store secrets in AWS Secrets Manager

#### Google Cloud Run
- Deploy from Container Registry
- Use Cloud SQL for database
- Configure custom domain with SSL

#### Azure Container Instances
- Use Azure Container Registry
- Connect to Azure Database for PostgreSQL
- Configure Application Gateway

## SSL and Domain Setup

### Development (Self-signed)
```bash
# Generated automatically by deploy script
openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

### Production (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx.conf with certificate paths
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

## Database Management

### Initial Setup
```bash
# Database schema is created automatically
# Admin user must be created manually:

docker exec -it db_container psql -U postgres -d high_bred_bullies
```

```sql
-- Create admin user
INSERT INTO users (username, email, password_hash) 
VALUES ('admin', 'admin@yourdomain.com', '$2a$10$...');

-- Create breeder profile
INSERT INTO user_profiles (user_id, first_name, last_name, is_breeder)
VALUES (1, 'Admin', 'User', true);
```

### Backup and Restore
```bash
# Automated backup
./scripts/backup.sh

# Manual backup
docker exec db_container pg_dump -U postgres high_bred_bullies > backup.sql

# Restore from backup
docker exec -i db_container psql -U postgres high_bred_bullies < backup.sql
```

## Security Configuration

### Production Checklist
- [ ] Strong JWT_SECRET (32+ characters)
- [ ] HTTPS enabled with valid certificates
- [ ] Database access restricted
- [ ] Firewall configured
- [ ] Environment variables secured
- [ ] Regular security updates
- [ ] API rate limiting enabled
- [ ] CORS properly configured

### Recommended Security Headers
```nginx
add_header Strict-Transport-Security "max-age=63072000" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
```

## Monitoring and Logging

### Health Checks
- Application: `GET /api/health`
- Database connectivity verified
- Stripe API connectivity tested
- SMTP server availability checked

### Log Management
```bash
# View application logs
docker-compose logs -f app

# View database logs
docker-compose logs -f db

# View nginx logs
docker-compose logs -f nginx
```

### Monitoring Setup
- Configure log aggregation (ELK stack)
- Set up application monitoring (New Relic, DataDog)
- Database performance monitoring
- Alert on critical errors

## Performance Optimization

### Database
- Enable connection pooling
- Configure appropriate indexes
- Regular VACUUM and ANALYZE
- Monitor query performance

### Application
- Enable gzip compression
- Configure static asset caching
- Use CDN for images
- Optimize React bundle size

### Infrastructure
- Load balancer configuration
- Auto-scaling policies
- Resource allocation optimization
- Cache strategy implementation

## Stripe Integration

### Webhook Configuration
1. Create webhook endpoint in Stripe dashboard
2. Point to: `https://yourdomain.com/api/stripe/webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Add webhook secret to environment variables

### Product Setup
- Create products for different puppy categories
- Set up pricing for male/female puppies
- Configure tax rates if applicable
- Test payment flow thoroughly

## Email Configuration

### SMTP Settings
- Use dedicated email service (SendGrid, AWS SES)
- Configure SPF, DKIM, DMARC records
- Test email delivery to major providers
- Monitor bounce rates and reputation

### Template Customization
- Seasonal templates automatically switch
- Customize branding in email templates
- Test across email clients
- Configure unsubscribe handling

## Troubleshooting

### Common Issues

**Container won't start**
```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose config

# Test database connection
docker exec app npm run db:test
```

**Database connection errors**
- Verify DATABASE_URL format
- Check network connectivity
- Ensure database is running
- Validate credentials

**Payment processing issues**
- Verify Stripe keys are correct
- Check webhook configuration
- Test in Stripe dashboard
- Review transaction logs

**Email delivery problems**
- Verify SMTP credentials
- Check spam folder
- Test with different providers
- Review email logs

### Debug Mode
```bash
# Enable debug logging
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up -d
```

## Maintenance

### Regular Tasks
- Daily: Monitor logs and performance
- Weekly: Review security alerts
- Monthly: Update dependencies
- Quarterly: Security audit

### Updates
```bash
# Update application
git pull origin main
docker-compose build --no-cache app
docker-compose up -d app

# Database migrations
docker exec app npm run db:migrate
```

### Scaling
```bash
# Scale application horizontally
docker-compose up -d --scale app=5

# Add load balancer
# Configure sticky sessions for WebSocket
# Monitor resource usage
```

## Support

### Getting Help
1. Check application logs
2. Review this deployment guide
3. Verify environment configuration
4. Test with minimal setup

### Contact Information
- Technical issues: Check GitHub issues
- Deployment support: Review documentation
- Security concerns: Follow security reporting guidelines

This deployment guide ensures a secure, scalable production deployment of the High Bred Bullies platform.