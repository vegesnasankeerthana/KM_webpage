require('dotenv').config();
const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const { pool } = require('../db');
const { executeTool } = require('../tools/toolExecutor');
const { sendConfirmationEmail } = require('../utils/email');
const { sendSMSConfirmation }   = require('../utils/sms');


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Kyra, a warm and professional AI medical receptionist for Kyron Medical Group.
Today's date is ${new Date().toDateString()}.

You help patients with THREE workflows:
1. SCHEDULING APPOINTMENTS
2. PRESCRIPTION REFILL REQUESTS
3. OFFICE INFORMATION

DOCTORS & SPECIALTIES:
- Dr. Sarah Chen → Cardiologist (heart, chest pain, blood pressure, palpitations)
- Dr. James Miller → Orthopedist (bones, joints, back pain, knee, shoulder, spine)
- Dr. Priya Patel → Dermatologist (skin, rash, acne, eczema, moles)
- Dr. Robert Kim → Neurologist (brain, headaches, migraines, dizziness, seizures)

══════════════════════════════════════
SCHEDULING WORKFLOW — FOLLOW EXACTLY
══════════════════════════════════════

STAGE 1 — COLLECT INFORMATION (do this BEFORE calling any tool):
- First ask: "What brings you in today?"
- Then ask: "Which part of your body is concerning you?"
- Then ask: "May I have your first and last name?"
- Then ask: "What is your date of birth? (MM/DD/YYYY)"
- Then ask: "What is the best phone number to reach you?"
- Then ask: "And your email address for the confirmation?"

STAGE 2 — FIND SLOTS (only after ALL 6 fields collected):
- Call get_availability tool with body_part
- Present slots as: "📅 Monday, April 7 at 9:00 AM"
- Show 3-5 slots maximum
- If patient wants specific day, call get_availability again with preferred_day

STAGE 3 — CONFIRM AND BOOK:
- Once patient picks a slot, say: "Just to confirm — [date/time] with [doctor]. Shall I book this?"
- After patient says yes, call book_appointment with ALL collected data
- Confirm: "Your appointment is booked! A confirmation email has been sent to [email]. See you on [date]!"

══════════════════════════════════════
STRICT RULES — NEVER BREAK THESE
══════════════════════════════════════
1. NEVER call get_availability before collecting name, DOB, phone AND email
2. NEVER ask multiple fields at once — ONE question per response
3. NEVER show function names, tool names, JSON, or code in responses
4. NEVER give medical advice — say "Please speak with your doctor"
5. NEVER discuss pricing or insurance — refer to (212) 555-0200
6. Keep all responses under 80 words
7. Use patient first name warmly once collected
8. If body part not treated: "We don't have a specialist for that. We treat heart, bones/joints, skin, and neurological conditions."
9. Medical emergency: "If this is a medical emergency, please call 911 immediately."

══════════════════════════════════════
PRESCRIPTION REFILL WORKFLOW
══════════════════════════════════════
1. Ask for patient name
2. Ask for medication name
3. Call check_prescription_refill tool
4. Say: "Your refill request for [medication] has been logged. Our clinical team will contact you within 24 hours."

══════════════════════════════════════
OFFICE INFORMATION
══════════════════════════════════════
Address: 123 Medical Center Drive, Suite 400, New York, NY 10001
Hours: Monday-Friday 8:00 AM - 6:00 PM | Saturday 9:00 AM - 2:00 PM | Sunday Closed
Phone: (212) 555-0100`;

// ── Tool definitions — NO limit parameter to avoid type errors ──
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description: 'Get available appointment slots. Only call after collecting patient name, DOB, phone, and email.',
      parameters: {
        type: 'object',
        properties: {
          body_part: {
            type: 'string',
            description: 'Body part or symptom the patient described e.g. heart, knee, skin rash'
          },
          preferred_day: {
            type: 'string',
            description: 'Optional preferred day e.g. Monday, Tuesday, morning, afternoon'
          },
        },
        required: ['body_part'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book the appointment after patient explicitly confirms the slot. Requires all patient data.',
      parameters: {
        type: 'object',
        properties: {
          slot_id:      { type: 'number',  description: 'Slot ID from get_availability results' },
          doctor_id:    { type: 'number',  description: 'Doctor ID from get_availability results' },
          patient_name: { type: 'string',  description: 'Patient full first and last name' },
          dob:          { type: 'string',  description: 'Date of birth in MM/DD/YYYY format' },
          phone:        { type: 'string',  description: 'Patient phone number' },
          email:        { type: 'string',  description: 'Patient email address' },
          reason:       { type: 'string',  description: 'Reason for the appointment' },
          session_id:   { type: 'string',  description: 'Current chat session ID' },
          sms_opt_in:   { type: 'boolean', description: 'Whether patient agreed to SMS notifications' },
        },
        required: ['slot_id', 'doctor_id', 'patient_name', 'dob', 'phone', 'email', 'reason', 'session_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_office_info',
      description: 'Get the practice office address, hours of operation, and contact information',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_prescription_refill',
      description: 'Log a prescription refill request for a patient',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string', description: 'Full name of the patient' },
          phone:        { type: 'string', description: 'Patient phone number' },
          medication:   { type: 'string', description: 'Name of the medication to refill' },
        },
        required: ['patient_name', 'medication'],
      },
    },
  },
];

// ── Strip leaked function/tool syntax from AI output ─────────
function cleanResponse(text) {
  if (!text) return '';
  return text
    .replace(/\{function=\w+>[\s\S]*?\/function\}/g, '')
    .replace(/\(function=\w+>[\s\S]*?\)/g, '')
    .replace(/\{function=[\s\S]*?\}/g, '')
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/\[tool_use[\s\S]*?\]/g, '')
    .replace(/\{"body_part"[\s\S]*?\}/g, '')
    .replace(/\{"slot_id"[\s\S]*?\}/g, '')
    .replace(/\{"patient_name"[\s\S]*?\}/g, '')
    .replace(/\{"\w+":[\s\S]*?\}/g, '')
    .trim();
}

// ── POST /api/chat/message ───────────────────────────────────
router.post('/message', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId are required' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM conversations WHERE session_id=$1', [sessionId]
    );
    let messages = rows[0]?.messages || [];
    messages.push({ role: 'user', content: message });

    const notifiers = {
      sendEmail: sendConfirmationEmail,
      sendSMS:   sendSMSConfirmation,
    };

    const loopMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    ];

    let finalText  = '';
    let iterations = 0;

    while (iterations < 8) {
      iterations++;

      const response = await groq.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        max_tokens:  1024,
        temperature: 0.2,
        messages:    loopMessages,
        tools,
        tool_choice: 'auto',
      });

      const msg = response.choices[0].message;
      loopMessages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          const name = toolCall.function.name;
          let args = {};
          try { args = JSON.parse(toolCall.function.arguments); } catch {}

          // Fix: ensure limit is always a number if present
          if (args.limit !== undefined) args.limit = parseInt(args.limit) || 5;

          console.log(`🔧 Tool: ${name}`, JSON.stringify(args).slice(0, 120));
          const result = await executeTool(name, args, notifiers);
          console.log(`✅ Result:`, JSON.stringify(result).slice(0, 120));

          loopMessages.push({
            role:         'tool',
            tool_call_id: toolCall.id,
            content:      JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = cleanResponse(msg.content || '');
      break;
    }

    if (!finalText) {
      finalText = "I'm sorry, I had a little trouble with that. Could you please try again?";
    }

    messages.push({ role: 'assistant', content: finalText });
    await pool.query(`
      INSERT INTO conversations (session_id, messages, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (session_id) DO UPDATE
        SET messages = $2, updated_at = NOW()
    `, [sessionId, JSON.stringify(messages)]);

    return res.json({ reply: finalText, sessionId });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({
      error: 'AI service error',
      reply: 'I apologize — something went wrong. Please try again in a moment.',
    });
  }
});

// ── GET /api/chat/history/:sessionId ────────────────────────
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT messages, patient_data, appointment_state FROM conversations WHERE session_id=$1',
      [req.params.sessionId]
    );
    if (!rows.length) return res.json({ messages: [], patientData: {} });
    return res.json({ messages: rows[0].messages, patientData: rows[0].patient_data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/chat/history/:sessionId ─────────────────────
router.delete('/history/:sessionId', async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE session_id=$1', [req.params.sessionId]);
  return res.json({ success: true });
});

module.exports = router;