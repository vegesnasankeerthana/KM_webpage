require('dotenv').config();
const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');
const { pool } = require('../db');
const { executeTool } = require('../tools/toolExecutor');
const { sendConfirmationEmail } = require('../utils/email');
const { sendSMSConfirmation }   = require('../utils/sms');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Kyra, a medical receptionist for Kyron Medical Group. Today: ${new Date().toDateString()}.

DOCTORS:
- Dr. Sarah Chen: Cardiologist (heart, chest, blood pressure)
- Dr. James Miller: Orthopedist (bones, joints, back, knee)
- Dr. Priya Patel: Dermatologist (skin, rash, acne)
- Dr. Robert Kim: Neurologist (headaches, migraines, dizziness)

WORKFLOW - collect these ONE at a time BEFORE calling any tool:
1. What brings them in
2. Body part/concern
3. Full name
4. Date of birth (MM/DD/YYYY)
5. Phone number
6. Email address

Only after collecting ALL 6 items, call get_availability.
After patient picks a slot and confirms, call book_appointment.

RULES:
- Never show JSON, tool names, or code to patient
- Never give medical advice
- Keep responses under 80 words
- One question per message`;

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_availability',
      description: 'Get available appointment slots based on body part. Only call after collecting all patient info.',
      parameters: {
        type: 'object',
        properties: {
          body_part: { type: 'string', description: 'Body part or symptom e.g. heart, knee, skin' },
          preferred_day: { type: 'string', description: 'Optional day preference e.g. Monday, morning' },
        },
        required: ['body_part'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book appointment after patient confirms. Requires all patient data.',
      parameters: {
        type: 'object',
        properties: {
          slot_id:      { type: 'string',  description: 'Slot ID from get_availability results' },
          doctor_id:    { type: 'string',  description: 'Doctor ID from get_availability results' },
          patient_name: { type: 'string',  description: 'Full name' },
          dob:          { type: 'string',  description: 'Date of birth MM/DD/YYYY' },
          phone:        { type: 'string',  description: 'Phone number' },
          email:        { type: 'string',  description: 'Email address' },
          reason:       { type: 'string',  description: 'Reason for visit' },
          session_id:   { type: 'string',  description: 'Session ID' },
          sms_opt_in:   { type: 'boolean', description: 'SMS opt in' },
        },
        required: ['slot_id', 'doctor_id', 'patient_name', 'dob', 'phone', 'email', 'reason', 'session_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_office_info',
      description: 'Get office address, hours, and contact information',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_prescription_refill',
      description: 'Log a prescription refill request',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string' },
          phone:        { type: 'string' },
          medication:   { type: 'string' },
        },
        required: ['patient_name', 'medication'],
      },
    },
  },
];

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
    .replace(/\{"\w+":\s*"[\s\S]*?\}/g, '')
    .trim();
}

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
        model:       'llama-3.3-70b-versatile',
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

          // Always convert slot_id and doctor_id to numbers
          if (args.slot_id !== undefined)   args.slot_id   = parseInt(args.slot_id);
          if (args.doctor_id !== undefined) args.doctor_id = parseInt(args.doctor_id);
          if (args.limit !== undefined)     args.limit     = parseInt(args.limit) || 5;

          console.log(`Tool: ${name}`, JSON.stringify(args).slice(0, 120));
          const result = await executeTool(name, args, notifiers);
          console.log(`Result:`, JSON.stringify(result).slice(0, 120));
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

router.delete('/history/:sessionId', async (req, res) => {
  await pool.query('DELETE FROM conversations WHERE session_id=$1', [req.params.sessionId]);
  return res.json({ success: true });
});

module.exports = router;