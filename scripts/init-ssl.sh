#!/bin/bash

# BackupControl - SSL Certificate Initialization Script
# This script initializes Let's Encrypt SSL certificates for the application

set -e

# Configuration
DOMAIN=${DOMAIN:-"backup.example.com"}
EMAIL=${LETSENCRYPT_EMAIL:-"admin@example.com"}
STAGING=${STAGING:-0}  # Set to 1 for testing to avoid rate limits

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         BackupControl - SSL Certificate Setup                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if domain is set
if [ "$DOMAIN" == "backup.example.com" ]; then
    echo -e "${YELLOW}Warning: Using default domain. Please set DOMAIN environment variable.${NC}"
    echo "Example: DOMAIN=your-domain.com ./scripts/init-ssl.sh"
    read -p "Continue with default domain? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}Domain: ${DOMAIN}${NC}"
echo -e "${GREEN}Email: ${EMAIL}${NC}"

# Create required directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Check if certificates already exist
if [ -d "./certbot/conf/live/${DOMAIN}" ]; then
    echo -e "${YELLOW}Certificates already exist for ${DOMAIN}${NC}"
    read -p "Do you want to renew them? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Using existing certificates.${NC}"
        exit 0
    fi
fi

# Create dummy certificates for initial nginx startup
echo -e "${YELLOW}Creating temporary self-signed certificate...${NC}"
mkdir -p ./certbot/conf/live/backupcontrol
openssl req -x509 -nodes -newkey rsa:4096 \
    -days 1 \
    -keyout ./certbot/conf/live/backupcontrol/privkey.pem \
    -out ./certbot/conf/live/backupcontrol/fullchain.pem \
    -subj "/CN=localhost" 2>/dev/null

echo -e "${GREEN}Temporary certificate created.${NC}"

# Start nginx with the temporary certificate
echo -e "${YELLOW}Starting nginx...${NC}"
docker-compose up -d nginx

# Wait for nginx to start
echo -e "${YELLOW}Waiting for nginx to be ready...${NC}"
sleep 5

# Request Let's Encrypt certificate
echo -e "${YELLOW}Requesting Let's Encrypt certificate...${NC}"

# Staging flag for testing
STAGING_FLAG=""
if [ "$STAGING" == "1" ]; then
    echo -e "${YELLOW}Using staging environment (for testing)${NC}"
    STAGING_FLAG="--staging"
fi

# Run certbot
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    ${STAGING_FLAG} \
    -d ${DOMAIN}

# Check if successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Certificate obtained successfully!${NC}"
    
    # Copy certificates to the right location
    echo -e "${YELLOW}Setting up certificates...${NC}"
    rm -rf ./certbot/conf/live/backupcontrol
    ln -s ./certbot/conf/live/${DOMAIN} ./certbot/conf/live/backupcontrol 2>/dev/null || \
        cp -rL ./certbot/conf/live/${DOMAIN} ./certbot/conf/live/backupcontrol
    
    # Reload nginx
    echo -e "${YELLOW}Reloading nginx...${NC}"
    docker-compose exec nginx nginx -s reload
    
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    SSL Setup Complete!                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Your application is now accessible at: ${GREEN}https://${DOMAIN}${NC}"
    echo ""
    echo -e "${YELLOW}Note: Certificates will auto-renew via the certbot container.${NC}"
else
    echo -e "${RED}Failed to obtain certificate!${NC}"
    echo "Please check your domain DNS settings and firewall."
    exit 1
fi
