// ─────────────────────────────────────────────────────────────
//  Tool definitions passed to Claude's API so it can
//  interact with the database during a conversation.
// ─────────────────────────────────────────────────────────────

const tools = [
  {
    name: 'get_availability',
    description: `Search for available appointment slots based on the patient's medical concern.
Returns a list of matching doctors and their open time slots.
Always call this before offering times to a patient.`,
    input_schema: {
      type: 'object',
      properties: {
        body_part: {
          type: 'string',
          description: 'The body part or symptom the patient described (e.g. "heart", "knee", "skin rash")',
        },
        preferred_day: {
          type: 'string',
          description: 'Optional day preference like "Tuesday" or "morning" or "next week"',
        },
        limit: {
          type: 'number',
          description: 'Max number of slots to return (default 5)',
        },
      },
      required: ['body_part'],
    },
  },

  {
    name: 'book_appointment',
    description: `Book a specific appointment slot for a patient.
Only call this AFTER the patient has explicitly confirmed the date, time, and doctor.
Requires all patient intake fields to be collected first.`,
    input_schema: {
      type: 'object',
      properties: {
        slot_id:      { type: 'number',  description: 'The exact slot ID from get_availability results' },
        doctor_id:    { type: 'number',  description: 'Doctor ID from get_availability results' },
        patient_name: { type: 'string',  description: 'Full name: "First Last"' },
        dob:          { type: 'string',  description: 'Date of birth: MM/DD/YYYY' },
        phone:        { type: 'string',  description: 'Patient phone number' },
        email:        { type: 'string',  description: 'Patient email address' },
        reason:       { type: 'string',  description: 'Reason for the appointment' },
        session_id:   { type: 'string',  description: 'Current session ID' },
        sms_opt_in:   { type: 'boolean', description: 'Whether patient opted in for SMS' },
      },
      required: ['slot_id', 'doctor_id', 'patient_name', 'dob', 'phone', 'email', 'reason', 'session_id'],
    },
  },

  {
    name: 'get_office_info',
    description: 'Returns the practice address, phone number, and hours of operation.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },

  {
    name: 'get_conversation_history',
    description: 'Retrieve a previous conversation by session ID or phone number, for voice call continuity.',
    input_schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID to look up' },
        phone:      { type: 'string', description: 'Phone number to look up (for inbound voice calls)' },
      },
    },
  },

  {
    name: 'check_prescription_refill',
    description: 'Log a prescription refill request from a patient.',
    input_schema: {
      type: 'object',
      properties: {
        patient_name: { type: 'string' },
        phone:        { type: 'string' },
        medication:   { type: 'string', description: 'Name of the medication to refill' },
      },
      required: ['patient_name', 'medication'],
    },
  },
];

module.exports = tools;
