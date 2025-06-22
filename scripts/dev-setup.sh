
#!/bin/bash

# Development setup script

set -e

echo "🛠️  Setting up development environment..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local template..."
    cat > .env.local << EOL
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: For development
VITE_ENVIRONMENT=development
EOL
    echo "⚠️  Please update .env.local with your actual Supabase credentials"
fi

echo "✅ Development environment setup complete!"
echo "🚀 Run 'npm run dev' to start the development server"
