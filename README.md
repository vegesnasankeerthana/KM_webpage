# 🏥 Kyron Medical — AI Patient Portal

A full-stack medical AI receptionist web app with real-time appointment scheduling,
voice call handoff, admin dashboard, AWS RDS persistence, and email/SMS confirmations.

---

## 📁 Project Structure

```
kyron-medical/
├── backend/
│   ├── server.js                  ← Express entry point
│   ├── db.js                      ← PostgreSQL pool + DB init + seeding
│   ├── routes/
│   │   ├── chat.js                ← AI chat with Claude + agentic tool loop
│   │   ├── admin.js               ← CRUD for slots/doctors
│   │   ├── appointments.js        ← Read appointments
│   │   └── voice.js               ← Vapi voice call initiation + webhook
│   ├── tools/
│   │   ├── appointmentTools.js    ← Claude tool definitions
│   │   └── toolExecutor.js        ← Tool logic (DB queries, matching)
│   ├── utils/
│   │   ├── email.js               ← Nodemailer confirmation emails
│   │   └── sms.js                 ← Twilio SMS confirmations
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── PatientChat.jsx    ← Main chat UI
    │   │   ├── AdminDashboard.jsx ← Real-time slot management
    │   │   └── AppointmentsPage.jsx
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── ChatWindow.jsx
    │   │   ├── MessageBubble.jsx
    │   │   ├── VoiceCallButton.jsx
    │   │   └── ToastContainer.jsx
    │   ├── hooks/useToast.js
    │   └── utils/api.js
    └── vite.config.js
```

---

## ✅ STEP-BY-STEP SETUP IN VS CODE

### STEP 1 — Install Prerequisites

Download and install these first:
- **Node.js 18+**: https://nodejs.org  (verify: `node -v`)
- **Git**: https://git-scm.com
- **VS Code**: https://code.visualstudio.com

---

### STEP 2 — Get API Keys (do this first, takes 10 min)

#### A. Anthropic (Claude AI) — REQUIRED
1. Go to https://console.anthropic.com
2. Sign up → "API Keys" → "Create Key"
3. Copy the key (starts with `sk-ant-`)

#### B. Gmail App Password (for emails) — RECOMMENDED
1. Go to your Google Account → Security → 2-Step Verification (enable it)
2. Then go to: https://myaccount.google.com/apppasswords
3. Create app password for "Mail" → copy the 16-char password

#### C. Twilio SMS — OPTIONAL
1. Sign up at https://twilio.com (free trial gives $15 credit)
2. Get a phone number → copy Account SID, Auth Token, Phone Number

#### D. Vapi Voice AI — OPTIONAL (for real voice calls)
1. Sign up at https://vapi.ai
2. Create an assistant with this system prompt:
   ```
   You are Kyra, medical receptionist for Kyron Medical Group.
   Retrieve context with session ID: {{sessionId}}
   Context: {{contextSummary}}
   Continue the conversation naturally. Never give medical advice.
   ```
3. Add a phone number → copy API Key, Assistant ID, Phone Number ID

---

### STEP 3 — Clone & Install

Open VS Code Terminal (`Ctrl + `` ` ``):

```bash
# Clone your repo (or just use the folder you already have)
cd Desktop
# If starting fresh:
git clone https://github.com/YOUR_USERNAME/kyron-medical.git
cd kyron-medical

# ── Install backend dependencies ──
cd backend
npm install

# ── Install frontend dependencies ──
cd ../frontend
npm install

cd ..
```

---

### STEP 4 — Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in your keys:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE

# For local dev use these (no RDS needed yet):
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kyron_medical
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_16_char_app_password

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

VAPI_API_KEY=...
VAPI_ASSISTANT_ID=...
VAPI_PHONE_NUMBER_ID=...
```

---

### STEP 5 — Set Up Local PostgreSQL

#### Option A: Install PostgreSQL locally
1. Download from https://postgresql.org/download
2. Install with default settings, set password to `postgres`
3. Open pgAdmin or run:

```bash
psql -U postgres
CREATE DATABASE kyron_medical;
\q
```

#### Option B: Use Docker (easier)
```bash
docker run --name kyron-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kyron_medical \
  -p 5432:5432 -d postgres:15
```

---

### STEP 6 — Run the App Locally

Open **two terminals** in VS Code (`Ctrl+Shift+5` splits terminal):

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Should print:
# ✅ Database initialized successfully
# ✅ Availability seeded for 45 days
# 🚀 Kyron Medical server running on port 3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Should print:
# VITE ready in 800ms
# ➜  Local: http://localhost:5173
```

Open http://localhost:5173 in your browser 🎉

---

## 🚀 DEPLOYING TO AWS EC2 (Production)

### STEP 7 — Create AWS RDS PostgreSQL Database

1. Log in to https://console.aws.amazon.com
2. Go to **RDS** → **Create database**
3. Settings:
   - Engine: **PostgreSQL 15**
   - Template: **Free tier**
   - DB instance identifier: `kyron-medical-db`
   - Master username: `postgres`
   - Master password: (choose a strong password, save it!)
   - Instance: `db.t3.micro`
   - Storage: `20 GB`
   - **Publicly accessible: YES** (for setup; set to NO later)
4. Click **Create database** — takes 5 min
5. Once available, copy the **Endpoint** (looks like `kyron-medical-db.xxxx.us-east-1.rds.amazonaws.com`)
6. Go to its **Security Group** → **Inbound rules** → Add rule:
   - Type: `PostgreSQL`, Port: `5432`, Source: `0.0.0.0/0` (temporary for setup)

---

### STEP 8 — Launch EC2 Instance

1. Go to **EC2** → **Launch Instance**
2. Settings:
   - Name: `kyron-medical-server`
   - AMI: **Ubuntu 22.04 LTS**
   - Instance type: `t3.small` ($0.02/hr) or `t2.micro` (free tier)
   - Key pair: **Create new** → name it `kyron-key` → download `.pem` file → **SAVE IT SAFELY**
   - Network settings → **Edit** → Add inbound rules:
     - SSH (22): My IP
     - HTTP (80): Anywhere
     - HTTPS (443): Anywhere
     - Custom TCP (3001): Anywhere (optional, for testing)
3. Click **Launch Instance**
4. Copy the **Public IPv4 address**

---

### STEP 9 — SSH Into EC2 & Set Up Server

```bash
# On your local machine:
chmod 400 ~/Downloads/kyron-key.pem

# SSH in (replace with your EC2 public IP):
ssh -i ~/Downloads/kyron-key.pem ubuntu@YOUR_EC2_IP

# ── Once inside the EC2 server ────────────────────────────────

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Clone your repo
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/kyron-medical.git
cd kyron-medical/backend

# Install dependencies
npm install --production

# Create .env file with your production keys
nano .env
# Paste your .env contents (use RDS endpoint for DB_HOST, set DB_SSL=true, NODE_ENV=production)
# Ctrl+X → Y → Enter to save

# Build frontend
cd ../frontend
npm install
npm run build
# This creates frontend/dist/ folder

# Start backend with PM2
cd ../backend
pm2 start server.js --name kyron-backend
pm2 startup          # Follow the printed command to enable auto-start
pm2 save
```

---

### STEP 10 — Configure Nginx (Reverse Proxy + HTTPS)

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/kyron

# Paste this (replace yourdomain.com with your actual domain or EC2 IP):
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # API → Node.js backend
    location /api/ {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       $host;
        proxy_cache_bypass $http_upgrade;
    }

    # React frontend (static files)
    location / {
        root  /home/ubuntu/kyron-medical/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/kyron /etc/nginx/sites-enabled/
sudo nginx -t          # Should say "syntax is ok"
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

### STEP 11 — Add HTTPS with Let's Encrypt (Free SSL)

```bash
# You need a real domain name for this.
# Point your domain's A record to your EC2 public IP first.
# Then:

sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts. Certbot auto-renews every 90 days.
# Your site is now live at https://yourdomain.com 🎉
```

**If you don't have a domain yet**, use a free one from:
- https://freedns.afraid.org
- https://noip.com

---

### STEP 12 — Update RDS Security Group (Lock It Down)

Now that EC2 is running:
1. Go to RDS → your DB → Security Group
2. Edit inbound rule for port 5432: change Source from `0.0.0.0/0` to your EC2's **Security Group ID**
3. This means only your EC2 can reach the database

---

## 🔄 Updating the App After Code Changes

```bash
# On EC2:
cd /home/ubuntu/kyron-medical
git pull

# Rebuild frontend
cd frontend && npm install && npm run build

# Restart backend
cd ../backend && npm install
pm2 restart kyron-backend
```

---

## 🧪 Testing the Non-Happy-Path Scenarios

The app handles these edge cases:
1. **No doctor for body part** → "We don't treat that — we cover heart, bones, skin, brain"
2. **Slot taken mid-conversation** → DB check at booking time, graceful error
3. **Network error** → Friendly error bubble in chat
4. **Empty message** → Send button disabled
5. **Page refresh** → Chat history restored from DB via session ID
6. **Voice call reconnect** → AI fetches prior chat via phone number lookup

---

## 📞 Vapi Voice AI Setup (Detailed)

1. Go to https://vapi.ai → Dashboard → **Assistants** → **Create Assistant**
2. System prompt:
```
You are Kyra, the AI medical receptionist for Kyron Medical Group.
The patient calling has this prior chat context: {{contextSummary}}
Patient name: {{patientName}}

Continue the conversation naturally from this context.
NEVER give medical advice or diagnoses.
Use the tools available to check availability and book appointments.
```
3. Under **Tools**, add a webhook tool pointing to `https://yourdomain.com/api/voice/webhook`
4. Under **Phone Numbers** → buy/import a number → copy the Phone Number ID
5. Fill in `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` in your `.env`

---

## 🛠 Tech Stack Summary

| Layer      | Technology                    |
|------------|-------------------------------|
| Frontend   | React 18 + Vite + Tailwind CSS |
| Backend    | Node.js + Express             |
| AI         | Anthropic Claude (claude-opus-4-5) |
| Database   | PostgreSQL (AWS RDS)          |
| Hosting    | AWS EC2 + Nginx               |
| HTTPS      | Let's Encrypt (Certbot)       |
| Email      | Nodemailer + Gmail SMTP       |
| SMS        | Twilio                        |
| Voice AI   | Vapi.ai                       |
| Process Mgr| PM2                           |

---

## 🆘 Common Issues

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED 5432` | PostgreSQL not running. Run `sudo systemctl start postgresql` |
| `AI not responding` | Check `ANTHROPIC_API_KEY` in `.env` |
| `CORS error` | Check `FRONTEND_URL` in backend `.env` matches your frontend URL |
| White screen | Run `npm run build` in frontend, check browser console |
| EC2 unreachable | Check Security Group has port 80/443 open |
| PM2 not starting | Run `pm2 logs kyron-backend` to see errors |
