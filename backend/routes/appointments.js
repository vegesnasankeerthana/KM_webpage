const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

// GET /api/appointments — all appointments (admin)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.color
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.slot_datetime ASC
    `);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/session/:sessionId — by session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, d.name as doctor_name, d.specialty
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.session_id=$1
      ORDER BY a.created_at DESC
    `, [req.params.sessionId]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
