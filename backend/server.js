require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const { initDB }  = require('./db');

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://km-webpage-frontend.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use('/api/chat',         require('./routes/chat'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/voice',        require('./routes/voice'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});


app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Kyron Medical server running on port ${PORT}`);
      console.log(`   ENV:      ${process.env.NODE_ENV || 'development'}`);
      console.log(`   AI Key:   ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
      console.log(`   DB Host:  ${process.env.DB_HOST || 'localhost'}`);
      console.log(`   Email:    ${process.env.SMTP_USER ? '✅ Set' : '⚠️  Not configured'}`);
      console.log(`   Twilio:   ${process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '⚠️  Not configured'}`);
      console.log(`   Vapi:     ${process.env.VAPI_API_KEY ? '✅ Set' : '⚠️  Not configured'}\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();