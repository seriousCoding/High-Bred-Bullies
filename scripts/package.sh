#!/bin/bash

# High Bred Bullies - Package Creation Script
set -e

PACKAGE_NAME="high-bred-bullies-deployment"
VERSION=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="${PACKAGE_NAME}-${VERSION}.tar.gz"

echo "📦 High Bred Bullies - Package Creation"
echo "======================================="
echo "Creating deployment package: $ARCHIVE_NAME"

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/$PACKAGE_NAME"

# Create package directory structure
mkdir -p "$PACKAGE_DIR"

# Copy essential files for deployment
echo "📄 Copying deployment files..."

# Core application files
cp -r client "$PACKAGE_DIR/"
cp -r server "$PACKAGE_DIR/"
cp -r shared "$PACKAGE_DIR/"
cp -r public "$PACKAGE_DIR/"
cp -r src "$PACKAGE_DIR/"
cp -r scripts "$PACKAGE_DIR/"

# Configuration files
cp package.json "$PACKAGE_DIR/"
cp package-lock.json "$PACKAGE_DIR/"
cp Dockerfile "$PACKAGE_DIR/"
cp docker-compose.yml "$PACKAGE_DIR/"
cp nginx.conf "$PACKAGE_DIR/"
cp .dockerignore "$PACKAGE_DIR/"
cp .env.template "$PACKAGE_DIR/"

# Documentation
cp README.md "$PACKAGE_DIR/"
cp DEPLOYMENT.md "$PACKAGE_DIR/"

# Build configuration
cp vite.config.ts "$PACKAGE_DIR/"
cp tsconfig.json "$PACKAGE_DIR/"
cp tsconfig.app.json "$PACKAGE_DIR/"
cp tsconfig.node.json "$PACKAGE_DIR/"
cp tailwind.config.ts "$PACKAGE_DIR/"
cp postcss.config.js "$PACKAGE_DIR/"
cp components.json "$PACKAGE_DIR/"
cp drizzle.config.ts "$PACKAGE_DIR/"
cp eslint.config.js "$PACKAGE_DIR/"

# Server files
cp auth-server.cjs "$PACKAGE_DIR/"
cp start-server.js "$PACKAGE_DIR/"

# Theme and configuration
cp theme.json "$PACKAGE_DIR/"
cp index.html "$PACKAGE_DIR/"

# Create deployment directories
mkdir -p "$PACKAGE_DIR/logs"
mkdir -p "$PACKAGE_DIR/ssl"
mkdir -p "$PACKAGE_DIR/backups"

# Create README for the package
cat > "$PACKAGE_DIR/PACKAGE_README.md" << 'EOF'
# High Bred Bullies - Deployment Package

This package contains everything needed to deploy the High Bred Bullies dog breeding platform.

## Quick Start

1. Extract the package:
   ```bash
   tar -xzf high-bred-bullies-deployment-*.tar.gz
   cd high-bred-bullies-deployment-*
   ```

2. Configure environment:
   ```bash
   cp .env.template .env
   # Edit .env with your actual values
   ```

3. Deploy:
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

## What's Included

- Complete React + TypeScript frontend
- Express.js backend with JWT authentication
- PostgreSQL database schema and migrations
- Stripe payment integration
- Email service with seasonal templates
- Docker configuration for easy deployment
- Nginx reverse proxy configuration
- Automated deployment and backup scripts
- Comprehensive documentation

## Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- PostgreSQL database
- Stripe account for payments
- SMTP server for emails

## Documentation

- `README.md` - Complete project documentation
- `DEPLOYMENT.md` - Detailed deployment guide
- `.env.template` - Environment configuration template

## Support

Refer to the documentation files for troubleshooting and configuration help.
EOF

# Exclude development-only files
echo "🧹 Cleaning development files..."
find "$PACKAGE_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PACKAGE_DIR" -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PACKAGE_DIR" -name "*.log" -type f -delete 2>/dev/null || true
rm -rf "$PACKAGE_DIR/.replit" 2>/dev/null || true
rm -rf "$PACKAGE_DIR/replit.nix" 2>/dev/null || true
rm -rf "$PACKAGE_DIR/attached_assets" 2>/dev/null || true

# Create the archive
echo "🗜️  Creating archive..."
cd "$TEMP_DIR"
tar -czf "$ARCHIVE_NAME" "$PACKAGE_NAME"

# Move to current directory
mv "$ARCHIVE_NAME" "$OLDPWD/"

# Cleanup
rm -rf "$TEMP_DIR"

# Display results
echo ""
echo "✅ Package created successfully!"
echo "📦 File: $ARCHIVE_NAME"
echo "📊 Size: $(du -h "$ARCHIVE_NAME" | cut -f1)"
echo ""
echo "🚀 Deployment Instructions:"
echo "1. Extract: tar -xzf $ARCHIVE_NAME"
echo "2. Configure: cp .env.template .env && edit .env"
echo "3. Deploy: chmod +x scripts/deploy.sh && ./scripts/deploy.sh"
echo ""
echo "📖 Documentation included:"
echo "- README.md (Project overview and setup)"
echo "- DEPLOYMENT.md (Production deployment guide)"
echo "- PACKAGE_README.md (Quick start for this package)"