#!/bin/bash

# High Bred Bullies - Project Export Script
# Creates a clean, downloadable version without node_modules

echo "Creating clean project export..."

# Create export directory
mkdir -p project-export

# Copy essential files
cp package.json project-export/
cp package-lock.json project-export/ 2>/dev/null || true
cp *.md project-export/
cp *.json project-export/
cp *.js project-export/
cp *.ts project-export/
cp .gitignore project-export/

# Copy directories (excluding node_modules and large assets)
cp -r client project-export/ 2>/dev/null || true
cp -r server project-export/ 2>/dev/null || true
cp -r shared project-export/ 2>/dev/null || true
cp -r public project-export/ 2>/dev/null || true
cp -r src project-export/ 2>/dev/null || true

# Create .env template
cat > project-export/.env.template << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://rtownsend@50.193.77.237:5432/high_bred

# JWT Secret (generate a secure random string)
JWT_SECRET=your_jwt_secret_here

# SMTP Configuration
SMTP_HOST=mail.firsttolaunch.com
SMTP_USER=admin@firsttolaunch.com
SMTP_PASS=your_smtp_password

# API Keys
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# App Configuration
NODE_ENV=development
PORT=5000
EOF

# Create setup instructions
cat > project-export/SETUP.md << 'EOF'
# High Bred Bullies - Setup Instructions

## Quick Start
1. Copy `.env.template` to `.env` and fill in your credentials
2. Run: `npm install`
3. Run: `npm run dev`
4. Visit: http://localhost:5000

## Database
- Uses PostgreSQL at 50.193.77.237:5432/high_bred
- Schema auto-created via Drizzle ORM
- No migrations needed - schema is in shared/schema.ts

## Features
- JWT Authentication
- Dog breeding management
- Stripe payments
- Email notifications
- AI content generation
- Social features

## Admin Access
- Email: gpass1979@gmail.com
- Password: gpass1979
EOF

# Create archive
cd project-export
tar -czf ../high-bred-bullies-clean.tar.gz .
cd ..

# Get size info
echo "Export complete!"
echo "Clean project size: $(du -sh project-export | cut -f1)"
echo "Archive size: $(du -sh high-bred-bullies-clean.tar.gz | cut -f1)"
echo "Files created:"
echo "  - project-export/ (directory)"
echo "  - high-bred-bullies-clean.tar.gz (archive)"