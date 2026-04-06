const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'kyron_medical',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Doctors table — with UNIQUE constraint on name
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL UNIQUE,
        specialty   VARCHAR(100) NOT NULL,
        body_parts  TEXT[]       NOT NULL DEFAULT '{}',
        color       VARCHAR(20)  DEFAULT '#3b82f6',
        initials    VARCHAR(5)   DEFAULT 'DR',
        active      BOOLEAN      DEFAULT true,
        created_at  TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    // Availability slots
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability (
        id            SERIAL PRIMARY KEY,
        doctor_id     INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
        slot_datetime TIMESTAMPTZ NOT NULL,
        is_booked     BOOLEAN     DEFAULT false,
        is_blocked    BOOLEAN     DEFAULT false,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_avail_doctor   ON availability(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_avail_datetime ON availability(slot_datetime);
    `);

    // Appointments
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id             SERIAL PRIMARY KEY,
        session_id     VARCHAR(100),
        patient_name   VARCHAR(200) NOT NULL,
        dob            VARCHAR(30),
        phone          VARCHAR(30),
        email          VARCHAR(200),
        reason         TEXT,
        doctor_id      INTEGER REFERENCES doctors(id),
        slot_id        INTEGER,
        slot_datetime  TIMESTAMPTZ,
        status         VARCHAR(30) DEFAULT 'confirmed',
        sms_opt_in     BOOLEAN     DEFAULT false,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_appts_session ON appointments(session_id);
      CREATE INDEX IF NOT EXISTS idx_appts_email   ON appointments(email);
    `);

    // Conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id                SERIAL PRIMARY KEY,
        session_id        VARCHAR(100) UNIQUE NOT NULL,
        phone             VARCHAR(30),
        messages          JSONB DEFAULT '[]',
        patient_data      JSONB DEFAULT '{}',
        appointment_state JSONB DEFAULT '{}',
        demo_step         INTEGER DEFAULT 0,
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_conv_phone   ON conversations(phone);
    `);

    // ── Seed 4 doctors — ON CONFLICT ON name means no duplicates ever ──
    await client.query(`
      INSERT INTO doctors (name, specialty, body_parts, color, initials) VALUES
        ('Dr. Sarah Chen',   'Cardiologist',  ARRAY['heart','chest','cardiovascular','palpitations','blood pressure'], '#ef4444', 'SC'),
        ('Dr. James Miller', 'Orthopedist',   ARRAY['bones','joints','back','knee','shoulder','hip','fracture','spine','wrist'], '#3b82f6', 'JM'),
        ('Dr. Priya Patel',  'Dermatologist', ARRAY['skin','rash','acne','mole','eczema','psoriasis','hair','nail'], '#8b5cf6', 'PP'),
        ('Dr. Robert Kim',   'Neurologist',   ARRAY['brain','head','headache','migraine','dizziness','seizure','memory','nerve'], '#f59e0b', 'RK')
      ON CONFLICT (name) DO NOTHING;
    `);

    // ── Seed availability only if table is empty ───────────────────
    const { rows: doctors }  = await client.query('SELECT id FROM doctors ORDER BY id LIMIT 4');
    const { rows: existing } = await client.query('SELECT COUNT(*) as c FROM availability');

    if (parseInt(existing[0].c) === 0) {
      const now   = new Date();
      const hours = [9, 10, 11, 14, 15, 16];
      for (const doc of doctors) {
        for (let day = 1; day <= 45; day++) {
          const d = new Date(now);
          d.setDate(d.getDate() + day);
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          for (const h of hours) {
            if (Math.random() < 0.3) continue;
            const slotDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0);
            await client.query(
              'INSERT INTO availability (doctor_id, slot_datetime) VALUES ($1, $2)',
              [doc.id, slotDt]
            );
          }
        }
      }
      console.log('✅ Availability seeded for 45 days');
    }

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ DB init error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
