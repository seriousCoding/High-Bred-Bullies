#!/bin/bash

# High Bred Bullies - Deployment Script
set -e

echo "🐕 High Bred Bullies - Deployment Script"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating deployment directories..."
mkdir -p logs ssl scripts

# Check for environment file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://postgres:your_secure_password@db:5432/high_bred_bullies
PGHOST=db
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_secure_password
PGDATABASE=high_bred_bullies

# Authentication
JWT_SECRET=your_jwt_secret_key_32_characters_minimum

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
SMTP_FROM=noreply@yourdomain.com

# Application
NODE_ENV=production
PORT=5000
EOF
    echo "✅ Created .env template. Please update with your actual values."
    echo "⚠️  Do not proceed until you've configured the .env file!"
    exit 1
fi

# Validate critical environment variables
source .env
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_jwt_secret_key_32_characters_minimum" ]; then
    echo "❌ JWT_SECRET must be set to a secure value (32+ characters)"
    exit 1
fi

if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == *"your_secure_password"* ]]; then
    echo "❌ DATABASE_URL must be configured with your database credentials"
    exit 1
fi

echo "✅ Environment variables validated"

# Create database initialization script
echo "📄 Creating database initialization script..."
cat > scripts/init.sql << 'EOF'
-- High Bred Bullies Database Initialization
-- This file will be executed when the database container starts

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Note: Application will create tables automatically using Drizzle migrations
EOF

# Generate self-signed SSL certificates for development
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "🔐 Generating self-signed SSL certificates..."
    openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=HighBredBullies/CN=localhost"
    echo "✅ SSL certificates generated"
fi

# Build and start the application
echo "🏗️  Building application..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Application is running at http://localhost:5000"
else
    echo "❌ Application health check failed"
    echo "📋 Checking logs..."
    docker-compose logs app
    exit 1
fi

# Display running services
echo ""
echo "🎉 Deployment completed successfully!"
echo "======================================"
echo "🌐 Application: http://localhost:5000"
echo "🗄️  Database: localhost:5432"
echo "📊 View logs: docker-compose logs -f"
echo "🛑 Stop services: docker-compose down"
echo ""
echo "📝 Next steps:"
echo "1. Create your first admin user"
echo "2. Configure Stripe webhooks"
echo "3. Set up your domain and SSL certificates"
echo "4. Configure email templates"
echo ""
echo "For production deployment, update nginx.conf with your domain"
echo "and replace self-signed certificates with proper SSL certificates."
EOF