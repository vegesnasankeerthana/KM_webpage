#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Kyron Medical — EC2 Auto-Setup Script
#  Run this ONCE on a fresh Ubuntu 22.04 EC2 instance:
#  bash deploy.sh
# ═══════════════════════════════════════════════════════════
set -e

REPO_URL="https://github.com/YOUR_USERNAME/kyron-medical.git"
APP_DIR="/home/ubuntu/kyron-medical"
DOMAIN="yourdomain.com"   # Change this or leave blank for IP-only

echo ""
echo "══════════════════════════════════════════"
echo "  Kyron Medical EC2 Setup"
echo "══════════════════════════════════════════"
echo ""

# ── 1. System packages ──────────────────────────────────────
echo "📦 Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y git nginx certbot python3-certbot-nginx curl

# ── 2. Node.js 18 ───────────────────────────────────────────
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 3. PM2 ──────────────────────────────────────────────────
echo "📦 Installing PM2..."
sudo npm install -g pm2

# ── 4. Clone repo ───────────────────────────────────────────
echo "📁 Cloning repository..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# ── 5. Backend ──────────────────────────────────────────────
echo "⚙️  Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --production

# Check .env exists
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  No .env file found!"
  echo "   Copy .env.example to .env and fill in your keys:"
  echo "   cp $APP_DIR/backend/.env.example $APP_DIR/backend/.env"
  echo "   nano $APP_DIR/backend/.env"
  echo ""
fi

# ── 6. Frontend build ───────────────────────────────────────
echo "🔨 Building React frontend..."
cd "$APP_DIR/frontend"
npm install
VITE_API_URL=/api npm run build

# ── 7. Nginx config ─────────────────────────────────────────
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/kyron > /dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN _;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       \$host;
        proxy_set_header   X-Real-IP  \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    location / {
        root  $APP_DIR/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        root   $APP_DIR/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/kyron /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# ── 8. PM2 start ────────────────────────────────────────────
echo "🚀 Starting backend with PM2..."
cd "$APP_DIR/backend"
pm2 delete kyron-backend 2>/dev/null || true
pm2 start server.js --name kyron-backend --env production
pm2 startup | tail -1 | bash  2>/dev/null || true
pm2 save

# ── 9. Optional: HTTPS ──────────────────────────────────────
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "yourdomain.com" ]; then
  echo "🔒 Setting up HTTPS with Let's Encrypt..."
  sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN"
fi

# ── Done ────────────────────────────────────────────────────
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")
echo ""
echo "══════════════════════════════════════════"
echo "  ✅  Kyron Medical is LIVE!"
echo ""
echo "  🌐  http://$EC2_IP"
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "yourdomain.com" ]; then
  echo "  🔒  https://$DOMAIN"
fi
echo ""
echo "  📋  View logs:   pm2 logs kyron-backend"
echo "  🔄  Restart:     pm2 restart kyron-backend"
echo "  📊  Monitor:     pm2 monit"
echo "══════════════════════════════════════════"
echo ""
