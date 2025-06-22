
#!/bin/bash

# Deployment script for High Bred Bullies

set -e

echo "🚀 Starting deployment..."

# Build the application
echo "📦 Building application..."
npm run build

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker found, building container..."
    docker build -t high-bred-bullies:latest .
    
    echo "✅ Container built successfully!"
    echo "To run: docker run -p 3000:80 high-bred-bullies:latest"
else
    echo "⚠️  Docker not found, skipping container build"
fi

echo "✅ Deployment preparation complete!"
echo "📁 Built files are in the 'dist' directory"
echo "🔗 Deploy to your hosting platform of choice"
