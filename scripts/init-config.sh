#!/bin/bash
set -e

echo "Docker Manager - Configuration Setup"
echo "========================================"
echo ""

# Copy config template if doesn't exist
if [ ! -f "backend/config/config.toml" ]; then
  echo "Creating config.toml from template..."
  cp backend/config.toml.template backend/config/config.toml
  echo "Created backend/config/config.toml"
else
  echo "config.toml already exists, skipping..."
fi

echo ""

# Copy .env.example if .env doesn't exist
if [ ! -f ".env" ]; then
  echo "Creating .env from template..."
  cp .env.example .env

  # Generate random JWT secret
  if command -v openssl &>/dev/null; then
    JWT_SECRET=$(openssl rand -base64 32)
    # Use different sed syntax based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s/your-secret-key-change-this-in-production/$JWT_SECRET/g" .env
    else
      # Linux
      sed -i "s/your-secret-key-change-this-in-production/$JWT_SECRET/g" .env
    fi
    echo "Created .env with random JWT_SECRET"
  else
    echo "Created .env (please install openssl to auto-generate JWT_SECRET)"
  fi

  echo ""
  echo "IMPORTANT: Update the following in .env:"
  echo "   - DB_PASSWORD (database password)"
  echo "   - ADMIN_PASSWORD (initial admin user password)"
else
  echo ".env already exists, skipping..."
fi

echo ""
echo "Configuration setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/config/config.toml to customize application settings"
echo "2. Edit .env to set secrets (JWT_SECRET, DB_PASSWORD, ADMIN_PASSWORD)"
echo "3. Run: docker-compose up -d"
