#!/bin/bash
# Setup script for Lead Management Dashboard

echo "🚀 Setting up Lead Management Dashboard..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✓ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file from .env.example..."
    cp .env.example .env
    echo "✓ .env file created. Please edit it with your PostgreSQL credentials."
    echo ""
fi

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL CLI is not installed. Make sure PostgreSQL server is running on localhost:5432"
else
    echo "✓ PostgreSQL CLI found"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file with your PostgreSQL credentials"
echo "2. Make sure PostgreSQL is running"
echo "3. Run: npm run db:migrate"
echo "4. Run: npm start"
echo ""
echo "🌐 Access the app at http://localhost:5000"
