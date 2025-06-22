# High Bred Bullies - Coinbase Advanced Trading Platform

## Overview

High Bred Bullies is a comprehensive Coinbase Advanced Trade API client with robust WebSocket integration for real-time cryptocurrency trading and data synchronization. The platform combines a React/TypeScript frontend with Express.js backend and PostgreSQL database, providing features for API key management, real-time market data, trading operations, and OAuth integration. The application has been refactored from Supabase to use direct PostgreSQL connections with JWT authentication.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **State Management**: React Query (@tanstack/react-query) for server state management
- **Routing**: React Router for client-side navigation
- **Theme**: Dark/light mode support via next-themes

### Backend Architecture
- **Database**: PostgreSQL with direct connections (database: high_bred)
- **ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT token-based authentication with bcryptjs
- **Server**: Express.js with TypeScript
- **Real-time**: WebSocket integration for live market data
- **API Integration**: Coinbase Advanced Trade API and OAuth

### External Integrations
- **Payment Processing**: Stripe for handling puppy purchases and checkout
- **Email Service**: Resend API for transactional emails
- **AI Services**: OpenAI API for content generation (blog posts, social content)
- **OAuth**: Coinbase OAuth integration for specialized features

## Key Components

### Database Schema
The application uses a comprehensive PostgreSQL schema with the following core tables:

- **Authentication**: `auth.users` (Supabase managed)
- **User Management**: `user_profiles`, `breeders`, `pet_owners`
- **Breeding Operations**: `litters`, `puppies`, `orders`, `order_items`
- **Content Management**: `blog_posts`, `social_posts`, `inquiries`
- **Social Features**: `social_post_likes`, `social_post_comments`, `user_follows`
- **Notifications**: `user_notifications`, `pickup_reminders`
- **Configuration**: `site_config`, `api_keys`

### Real-time Synchronization
The application implements sophisticated real-time updates using database triggers and Supabase Realtime:
- Puppy availability counts update automatically across all pages
- Database function `update_litter_puppy_count` maintains data consistency
- Frontend uses React Query cache invalidation for instant UI updates

### Authentication & Authorization
- Row Level Security (RLS) policies control data access
- User roles: anonymous users, authenticated users, breeders, pet owners
- Security definer functions for complex authorization logic
- OAuth integration with Coinbase for specialized features

### Payment Processing
- Stripe integration for secure payment processing
- Dynamic pricing based on puppy gender and litter specifications
- Checkout session management with metadata for order tracking
- Webhook handling for payment confirmation

## Data Flow

### User Registration & Authentication
1. User registers through Supabase Auth
2. Trigger function creates user profile automatically
3. Optional breeder registration for business accounts
4. RLS policies enforce data access controls

### Litter Management
1. Breeders create litters with dam/sire information
2. Stripe products and prices created automatically
3. Puppies added with individual characteristics
4. Real-time availability updates propagate to all views

### Purchase Flow
1. User selects puppies and delivery options
2. Stripe checkout session created with metadata
3. Payment processing and confirmation
4. Order creation with scheduling deadlines
5. Email notifications sent to all parties

### Content Generation
1. Scheduled cron jobs trigger AI content generation
2. OpenAI API generates blog posts and social content
3. Image generation via DALL-E integration
4. Content moderation and approval workflow

## External Dependencies

### Core Services
- **Supabase**: Database, authentication, storage, edge functions
- **Stripe**: Payment processing and subscription management
- **Resend**: Email delivery service
- **OpenAI**: AI content generation and image creation

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **ESLint**: Code linting and quality enforcement
- **Tailwind CSS**: Utility-first styling framework
- **Vite**: Fast build tool and development server

### UI Components
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **Embla Carousel**: Image carousels and sliders
- **React Hook Form**: Form state management

## Deployment Strategy

### Development Environment
- Replit-based development with Node.js 20
- PostgreSQL 16 database instance
- Environment variables for API keys and configuration
- Hot reload development server on port 5000

### Production Deployment
- **Primary**: Replit autoscale deployment
- **Alternative**: Docker containerization with Nginx
- **Database**: Supabase managed PostgreSQL
- **CDN**: Supabase Storage for static assets
- **Monitoring**: Supabase dashboard and logs

### Environment Configuration
- Coinbase OAuth credentials for specialized features
- Stripe API keys for payment processing
- OpenAI API key for AI content generation
- SMTP configuration for email delivery
- Supabase project credentials

### Database Management
- Drizzle migrations for schema changes
- Automated backups via Supabase
- Row Level Security for data protection
- Real-time subscriptions for live updates

## Changelog

```
Changelog:
- June 22, 2025. Initial setup
- June 22, 2025. Major refactoring: Removed Supabase dependencies, implemented JWT authentication with PostgreSQL direct connections (database: high_bred), updated authentication system to use bcryptjs and JWT tokens, migrated from session-based to token-based authentication
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```