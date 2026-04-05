const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { pool } = require('../db');
require('dotenv').config();

// ── POST /api/voice/initiate ─────────────────────────────────
router.post('/initiate', async (req, res) => {
  try {
    const { sessionId, phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    // ── Normalize phone to E.164 (+1XXXXXXXXXX) ──────────────
    const digits = phone.replace(/\D/g, '');
    let e164;
    if (digits.length === 10) {
      e164 = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      e164 = `+${digits}`;
    } else {
      return res.status(400).json({ error: 'Please enter a valid 10-digit US phone number.' });
    }

    // Load conversation context from DB
    const { rows } = await pool.query(
      'SELECT messages, patient_data FROM conversations WHERE session_id=$1',
      [sessionId]
    );
    const conversation = rows[0];
    const history      = conversation?.messages || [];
    const patientData  = conversation?.patient_data || {};
    const ctxSummary   = buildContextSummary(history, patientData);

    // Store phone against session
    await pool.query(
      `INSERT INTO conversations (session_id, phone, messages, updated_at)
       VALUES ($1, $2, '[]', NOW())
       ON CONFLICT (session_id) DO UPDATE SET phone=$2, updated_at=NOW()`,
      [sessionId, e164]
    );

    // ── Call Vapi ─────────────────────────────────────────────
    const VAPI_API_KEY         = process.env.VAPI_API_KEY;
    const VAPI_ASSISTANT_ID    = process.env.VAPI_ASSISTANT_ID;
    const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID) {
      console.warn('Vapi not configured — demo mode');
      return res.json({ success: true, demo: true, phone: e164 });
    }

    console.log(`Initiating Vapi call to ${e164}`);
    console.log(`  Assistant ID:     ${VAPI_ASSISTANT_ID}`);
    console.log(`  Phone Number ID:  ${VAPI_PHONE_NUMBER_ID}`);

    const payload = {
      assistantId: VAPI_ASSISTANT_ID,
      customer: { number: e164 },
      assistantOverrides: {
        variableValues: {
          sessionId,
          contextSummary: ctxSummary,
          patientName: patientData?.name || '',
        },
      },
    };

    if (VAPI_PHONE_NUMBER_ID) {
      payload.phoneNumberId = VAPI_PHONE_NUMBER_ID;
    }

    const vapiRes = await axios.post(
      'https://api.vapi.ai/call/phone',
      payload,
      {
        headers: {
          Authorization:  `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    console.log(`Vapi call created, callId: ${vapiRes.data?.id}`);
    return res.json({ success: true, callId: vapiRes.data?.id, phone: e164 });

  } catch (err) {
    const vapiMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error('Voice initiate error:', vapiMsg);
    console.error('Full Vapi response:', JSON.stringify(err.response?.data || {}));
    return res.status(500).json({ error: 'Failed to initiate call', message: vapiMsg });
  }
});

// ── POST /api/voice/webhook ──────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    const { type, call, toolCallId, toolName, toolInput } = req.body;
    if (type === 'tool-call') {
      const { executeTool } = require('../tools/toolExecutor');
      const result = await executeTool(toolName, toolInput || {});
      return res.json({ result: JSON.stringify(result), toolCallId });
    }
    if (type === 'end-of-call-report') {
      const sessionId = call?.metadata?.sessionId;
      if (sessionId) {
        await pool.query(`UPDATE conversations SET updated_at=NOW() WHERE session_id=$1`, [sessionId]);
      }
      return res.json({ success: true });
    }
    return res.json({ received: true });
  } catch (err) {
    console.error('Voice webhook error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/voice/context/:sessionId ───────────────────────
router.get('/context/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM conversations WHERE session_id=$1', [req.params.sessionId]
    );
    if (!rows.length) return res.json({ context: '', patientData: {} });
    const conv = rows[0];
    return res.json({
      context:     buildContextSummary(conv.messages || [], conv.patient_data || {}),
      patientData: conv.patient_data || {},
      messages:    conv.messages || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

function buildContextSummary(messages, patientData) {
  if (!messages.length) return 'No prior chat history.';
  const recent = messages.slice(-10);
  const lines  = recent
    .filter(m => typeof m.content === 'string')
    .map(m => `${m.role === 'user' ? 'Patient' : 'Kyra'}: ${m.content}`)
    .join('\n');
  const patStr = Object.keys(patientData).length
    ? `\nCollected patient info: ${JSON.stringify(patientData)}`
    : '';
  return `[PRIOR CHAT CONTEXT]\n${lines}${patStr}\n[END CONTEXT]\nContinue naturally from here.`;
}

module.exports = router;