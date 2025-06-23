# High Bred Bullies - Dog Breeding Platform

A comprehensive web platform for American Bully breed management, providing advanced digital tools for breeders to track, engage, and optimize their breeding programs.

## Features

- **Breeding Management**: Track litters, puppies, and breeding records
- **User Authentication**: JWT-based authentication with role-based access
- **Payment Processing**: Stripe integration for puppy sales
- **Content Management**: Blog posts and social media features
- **Email System**: Automated notifications and seasonal templates
- **Real-time Features**: WebSocket support for live updates
- **Admin Dashboard**: Complete management interface for breeders

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL 16
- **Authentication**: JWT tokens with bcryptjs
- **Payments**: Stripe API
- **Email**: SMTP with seasonal templates
- **AI Integration**: OpenAI API for content generation
- **UI Framework**: Tailwind CSS + Shadcn/ui components

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Stripe account (for payments)
- SMTP server (for emails)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name
PGHOST=your_postgres_host
PGPORT=5432
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=your_database_name

# Authentication
JWT_SECRET=your_jwt_secret_key

# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key

# OpenAI Integration
OPENAI_API_KEY=your_openai_api_key

# Email Configuration
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=your_from_email

# Application
NODE_ENV=production
PORT=5000
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npm run db:push
   ```

4. Start the application:
   ```bash
   npm run dev    # Development
   npm start      # Production
   ```

## Docker Deployment

### Using Docker Compose (Recommended)

1. Update environment variables in `docker-compose.yml`
2. Deploy the application:
   ```bash
   docker-compose up -d
   ```

### Using Dockerfile Only

1. Build the image:
   ```bash
   docker build -t high-bred-bullies .
   ```

2. Run the container:
   ```bash
   docker run -d -p 5000:5000 --env-file .env high-bred-bullies
   ```

## Database Setup

The application uses PostgreSQL with the following key tables:

- `users` - User authentication and profiles
- `breeders` - Breeder business information
- `litters` - Litter records and details
- `puppies` - Individual puppy records
- `orders` - Purchase transactions
- `blog_posts` - Content management
- `social_posts` - Community features

### Database Migration

The application automatically creates required tables on startup. For manual migration:

```bash
npm run db:generate  # Generate migration files
npm run db:push      # Push schema to database
```

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user

### Litters & Puppies
- `GET /api/litters/featured` - Get featured litters
- `GET /api/litters/:id/manage` - Get litter management data
- `POST /api/puppies/stripe-prices` - Get bulk Stripe pricing

### Content
- `GET /api/blog/posts` - Get blog posts
- `GET /api/social_feed_posts` - Get social media posts

### Admin
- `GET /api/admin/social-posts` - Admin social post management
- `GET /api/litters/by-breeder/:id` - Get litters by breeder

## Configuration

### Stripe Integration

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe dashboard
3. Add products and prices for your puppies
4. Update environment variables with your keys

### Email Service

The application includes seasonal email templates that automatically adapt to holidays and seasons:

- Christmas/Winter themes with snowflakes
- Valentine's Day themes with hearts
- Halloween themes with autumn colors
- Spring/Summer themes with fresh designs

### OpenAI Integration

For AI-powered content generation:

1. Get an API key from OpenAI
2. Add to environment variables
3. Use for blog post generation and content moderation

## Admin User Setup

Create an admin user with breeder privileges:

```sql
-- Insert admin user
INSERT INTO users (username, email, password_hash, created_at) 
VALUES ('admin', 'admin@example.com', '$2a$10$hashed_password', NOW());

-- Insert breeder profile
INSERT INTO user_profiles (user_id, first_name, last_name, is_breeder, created_at)
VALUES ('user_id_here', 'Admin', 'User', true, NOW());
```

## Production Deployment

### Security Checklist

- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Use environment-specific Stripe keys
- [ ] Enable CORS for your domain only
- [ ] Set secure password policies

### Performance Optimization

- [ ] Enable database connection pooling
- [ ] Configure Redis for session storage
- [ ] Set up CDN for static assets
- [ ] Enable gzip compression
- [ ] Configure database indexing
- [ ] Set up monitoring and logging

### Monitoring

- Database connection health checks
- API endpoint monitoring
- Error logging and alerting
- Performance metrics tracking
- Stripe webhook monitoring

## Support

For technical support or questions:

1. Check the troubleshooting section below
2. Review the API documentation
3. Check database connection settings
4. Verify environment variables

## Troubleshooting

### Common Issues

**Database Connection Error**
- Verify DATABASE_URL format
- Check PostgreSQL server status
- Confirm firewall settings

**Authentication Issues**
- Verify JWT_SECRET is set
- Check token expiration settings
- Confirm password hashing

**Stripe Payment Errors**
- Verify API keys are correct
- Check webhook configuration
- Confirm product/price IDs

**Email Not Sending**
- Verify SMTP credentials
- Check email server settings
- Confirm from email address

## License

This project is proprietary software for High Bred Bullies breeding operations.

## Development

### Project Structure

```
├── client/           # React frontend application
├── server/           # Express.js backend
├── shared/           # Shared types and schemas
├── public/           # Static assets
├── scripts/          # Deployment and utility scripts
└── docs/            # Documentation
```

### Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Test thoroughly before deployment

### Database Schema

The application uses Drizzle ORM for type-safe database operations. Schema definitions are in `shared/schema.ts`.

For questions or support, contact the development team.