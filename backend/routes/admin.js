const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// ── GET /api/admin/doctors ───────────────────────────────────
router.get('/doctors', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM doctors WHERE active=true ORDER BY id'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/slots/:doctorId ──────────────────────────
router.get('/slots/:doctorId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, d.name as doctor_name, d.specialty
      FROM availability a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.doctor_id = $1
        AND a.slot_datetime > NOW()
      ORDER BY a.slot_datetime
      LIMIT 60
    `, [req.params.doctorId]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/slots ────────────────────────────────────
router.post('/slots', async (req, res) => {
  try {
    const { doctorId, datetime } = req.body;
    if (!doctorId || !datetime) {
      return res.status(400).json({ error: 'doctorId and datetime required' });
    }
    const dt = new Date(datetime);
    if (isNaN(dt)) return res.status(400).json({ error: 'Invalid datetime' });

    const { rows } = await pool.query(
      'INSERT INTO availability (doctor_id, slot_datetime) VALUES ($1,$2) RETURNING *',
      [doctorId, dt]
    );
    return res.json({ success: true, slot: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/slots/:id ───────────────────────────────
router.patch('/slots/:id', async (req, res) => {
  try {
    const { isBlocked, isBooked } = req.body;
    const updates = [];
    const vals    = [];
    if (isBlocked !== undefined) { updates.push(`is_blocked=$${vals.length+1}`); vals.push(isBlocked); }
    if (isBooked  !== undefined) { updates.push(`is_booked=$${vals.length+1}`);  vals.push(isBooked);  }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE availability SET ${updates.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    return res.json({ success: true, slot: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/slots/:id ──────────────────────────────
router.delete('/slots/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT is_booked FROM availability WHERE id=$1', [req.params.id]
    );
    if (!rows.length)     return res.status(404).json({ error: 'Slot not found' });
    if (rows[0].is_booked) return res.status(400).json({ error: 'Cannot delete a booked slot' });
    await pool.query('DELETE FROM availability WHERE id=$1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/appointments ──────────────────────────────
router.get('/appointments', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.color
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/stats ─────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [appts, slots, docs] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM appointments'),
      pool.query('SELECT COUNT(*) FROM availability WHERE is_booked=false AND is_blocked=false AND slot_datetime>NOW()'),
      pool.query('SELECT COUNT(*) FROM doctors WHERE active=true'),
    ]);
    return res.json({
      totalAppointments: parseInt(appts.rows[0].count),
      availableSlots:    parseInt(slots.rows[0].count),
      activeDoctors:     parseInt(docs.rows[0].count),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
