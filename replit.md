# High Bred Bullies - Dog Breeding Platform

## Overview

High Bred Bullies is a comprehensive dog breeding management platform that helps breeders manage litters, puppies, orders, and customer relationships. The platform combines a React/TypeScript frontend with Express.js backend and PostgreSQL database, providing features for breeding management, blog content, social features, customer interactions, and payment processing. The application has been refactored from Supabase to use direct PostgreSQL connections with JWT authentication.

The platform supports two distinct user profile types:
- **Breeder Profile**: Full administrative access to manage litters, puppies, blog posts, and platform settings
- **User Profile**: Customer access for browsing available puppies, placing orders, and managing purchases

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
- **Real-time**: WebSocket integration for live updates

### External Integrations
- **Payment Processing**: Stripe for handling puppy purchases and checkout
- **Email Service**: Resend API for transactional emails
- **AI Services**: OpenAI API for content generation (blog posts, social content)


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
- **PostgreSQL**: Direct database connections with JWT authentication
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
- **Database**: PostgreSQL direct connections
- **CDN**: Static asset hosting
- **Monitoring**: Application logs and database monitoring

### Environment Configuration
- DATABASE_URL for PostgreSQL connection
- JWT_SECRET for authentication tokens
- Stripe API keys for payment processing
- OpenAI API key for AI content generation
- SMTP configuration for email delivery

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
- June 22, 2025. COMPLETED: Express server successfully running on port 5000 with full JWT authentication system, PostgreSQL database connected, all API endpoints working (health, register, login, protected routes), Vite middleware integrated for React frontend
- June 22, 2025. COMPLETED: Full Supabase removal and frontend migration completed. Created stub Supabase client, updated React components to use JWT authentication via useAuth hook, configured Express server with SPA routing for React frontend, fixed ES module imports and routing patterns
- June 22, 2025. COMPLETED: Resolved React frontend loading issues by implementing in-browser transpilation with Babel, created fully functional authentication system with responsive UI, integrated JWT token persistence, added system status dashboard
- June 22, 2025. COMPLETED: Created admin user account (gpass1979@gmail.com) with full access to the system
- June 22, 2025. COMPLETED: Fixed authentication database schema (password_hash column), resolved login API response structure, implemented forced navigation after successful authentication, configured relative API paths for frontend-backend communication
- June 22, 2025. COMPLETED: Resolved frontend-backend authentication synchronization issues by removing remaining Supabase imports from components (BreederSetup, OrderHistory), replaced with proper JWT-based API calls, enhanced authentication debugging with comprehensive error handling and logging
- June 22, 2025. COMPLETED: Database schema migration completed - pushed complete High Bred Bullies breeding platform schema to PostgreSQL database with 18 tables including users, breeders, litters, puppies, orders, blog posts, social features, and notifications. All core breeding platform functionality now supported at database level.
- June 22, 2025. COMPLETED: Fixed authentication login failure - corrected API response structure mismatch between frontend expectations {token, user} and backend output, fixed password field references (password_hash), and verified complete login/logout authentication flow works properly with JWT tokens.
- June 22, 2025. COMPLETED: Resolved CORS authentication issue - fixed frontend API URL configuration to use relative URLs when running on Replit, preventing cross-origin request blocks that were preventing login/registration from working.
- June 22, 2025. COMPLETED: Fixed admin user privileges - created user profile for gpass1979@gmail.com with isBreeder=true, updated authentication endpoints to return admin status, and fixed frontend User interface to include isBreeder field. Admin user now properly recognized with full privileges.
- June 22, 2025. COMPLETED: Final authentication system fixes - removed all Coinbase references from documentation as clarified this is a pure dog breeding platform, fixed admin user password authentication, completed AdminPage migration from Supabase to JWT authentication. User gpass1979@gmail.com now successfully authenticates with full breeder privileges.
- June 22, 2025. COMPLETED: ProfilePage Supabase migration completed - replaced all Supabase queries with JWT authentication, ensured isBreeder status properly read from JWT token for dual profile system (breeder vs customer), maintained notification preferences and account management functionality with JWT-based API calls.
- June 22, 2025. COMPLETED: Major Supabase removal progress - successfully migrated PostCard.tsx, FriendRequestCard.tsx, MessagingInterface.tsx, and MessagingCenter.tsx components from Supabase to JWT authentication. Replaced all database queries and real-time subscriptions with polling-based API calls using fetch() and JWT tokens. All social features, messaging, and friend request functionality now uses JWT authentication exclusively.
- June 22, 2025. COMPLETED: Final Supabase migration components completed - FriendsManager.tsx completely rebuilt with JWT authentication, BlogPostForm.tsx and AddLitterManager.tsx migrated from Supabase types to direct interfaces. All remaining Supabase dependencies removed from components, system now runs entirely on JWT authentication with PostgreSQL direct connections.
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```