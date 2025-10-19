#!/bin/bash

set -e

NEW_JWT_SECRET=$(openssl rand -base64 32)
# Update .env
sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env

echo "Now restart the backend: docker compose restart backend"
