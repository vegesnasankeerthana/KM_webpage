const { pool } = require('../db');

const OFFICE_INFO = {
  name:    'Kyron Medical Group',
  address: '123 Medical Center Drive, Suite 400, New York, NY 10001',
  phone:   '(212) 555-0100',
  hours: {
    'Monday-Friday': '8:00 AM - 6:00 PM',
    'Saturday':      '9:00 AM - 2:00 PM',
    'Sunday':        'Closed',
  },
  parking: 'Free parking available in the attached garage',
  transit: 'Subway: E/M trains to Lexington Ave-53 St',
};

async function matchDoctor(bodyPart) {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE active = true');
  const bp = bodyPart.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const doc of rows) {
    const parts = doc.body_parts || [];
    const score = parts.reduce((s, p) => s + (bp.includes(p) || p.includes(bp) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = doc; }
  }
  return bestScore > 0 ? best : null;
}

async function executeTool(toolName, input, notifiers = {}) {
  try {
    switch (toolName) {

      case 'get_availability': {
        const doctor = await matchDoctor(input.body_part || '');
        if (!doctor) {
          return {
            success: false,
            message: `We don't have a specialist for "${input.body_part}". We treat heart, bone/joint, skin, and neurological conditions.`,
          };
        }

        let query = `
          SELECT a.id, a.slot_datetime, d.id as doctor_id, d.name as doctor_name, d.specialty
          FROM availability a
          JOIN doctors d ON a.doctor_id = d.id
          WHERE a.doctor_id = $1
            AND a.is_booked  = false
            AND a.is_blocked = false
            AND a.slot_datetime > NOW()
        `;
        const params = [doctor.id];

        if (input.preferred_day) {
          const day = input.preferred_day.toLowerCase();
          const dayMap = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6, sunday:0 };
          const matched = Object.entries(dayMap).find(([k]) => day.includes(k));
          if (matched) {
            query += ` AND EXTRACT(DOW FROM a.slot_datetime) = $${params.length + 1}`;
            params.push(matched[1]);
          } else if (day.includes('morning')) {
            query += ` AND EXTRACT(HOUR FROM a.slot_datetime) < 12`;
          } else if (day.includes('afternoon')) {
            query += ` AND EXTRACT(HOUR FROM a.slot_datetime) >= 12`;
          }
        }

        // Always use a safe number for limit
        const limit = parseInt(input.limit) || 5;
        query += ` ORDER BY a.slot_datetime LIMIT $${params.length + 1}`;
        params.push(limit);

        const { rows: slots } = await pool.query(query, params);
        if (!slots.length) {
          return {
            success: false,
            doctor:  { id: doctor.id, name: doctor.name, specialty: doctor.specialty },
            message: 'No available slots found for that preference. Try a different day.',
          };
        }

        return {
          success: true,
          doctor:  { id: slots[0].doctor_id, name: slots[0].doctor_name, specialty: slots[0].specialty },
          slots: slots.map(s => ({
            id:       s.id,
            datetime: s.slot_datetime,
            label:    new Date(s.slot_datetime).toLocaleString('en-US', {
              weekday:'long', month:'long', day:'numeric',
              hour:'numeric', minute:'2-digit', timeZone:'America/New_York',
            }),
          })),
        };
      }

      case 'book_appointment': {
        const { rows: check } = await pool.query(
          'SELECT * FROM availability WHERE id=$1 AND is_booked=false AND is_blocked=false',
          [input.slot_id]
        );
        if (!check.length) {
          return { success: false, message: 'That slot was just taken. Please choose another time.' };
        }

        const slotDatetime = check[0].slot_datetime;
        const client = await pool.connect();

        try {
          await client.query('BEGIN');
          await client.query('UPDATE availability SET is_booked=true WHERE id=$1', [input.slot_id]);

          const { rows } = await client.query(`
            INSERT INTO appointments
              (session_id, patient_name, dob, phone, email, reason, doctor_id, slot_id, slot_datetime, sms_opt_in, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed')
            RETURNING *`,
            [input.session_id, input.patient_name, input.dob, input.phone,
             input.email, input.reason, input.doctor_id, input.slot_id,
             slotDatetime, input.sms_opt_in || false]
          );
          await client.query('COMMIT');

          const appt   = rows[0];
          const { rows: docRows } = await pool.query('SELECT * FROM doctors WHERE id=$1', [input.doctor_id]);
          const doctor = docRows[0];

          console.log(`📅 Booked: ${input.patient_name} with ${doctor?.name} on ${slotDatetime}`);

          // Send email
          if (notifiers.sendEmail && input.email) {
            try {
              await notifiers.sendEmail(input.email, {
                patientName: input.patient_name,
                doctorName:  doctor?.name || 'your doctor',
                specialty:   doctor?.specialty || '',
                datetime:    slotDatetime,
                reason:      input.reason,
                address:     OFFICE_INFO.address,
                phone:       OFFICE_INFO.phone,
              });
              console.log(`✅ Email sent to ${input.email}`);
            } catch (e) {
              console.error('❌ Email failed:', e.message);
            }
          }

          // Send SMS
          if (notifiers.sendSMS && input.sms_opt_in && input.phone) {
            try {
              await notifiers.sendSMS(input.phone, {
                patientName: input.patient_name,
                doctorName:  doctor?.name || 'your doctor',
                datetime:    slotDatetime,
              });
              console.log(`✅ SMS sent to ${input.phone}`);
            } catch (e) {
              console.error('❌ SMS failed:', e.message);
            }
          }

          return {
            success: true,
            appointment: {
              id:          appt.id,
              patientName: input.patient_name,
              doctor:      doctor?.name,
              specialty:   doctor?.specialty,
              datetime:    slotDatetime,
              address:     OFFICE_INFO.address,
            },
          };
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      case 'get_office_info': {
        return { success: true, info: OFFICE_INFO };
      }

      case 'get_conversation_history': {
        let row = null;
        if (input.session_id) {
          const { rows } = await pool.query(
            'SELECT * FROM conversations WHERE session_id=$1', [input.session_id]
          );
          row = rows[0];
        } else if (input.phone) {
          const { rows } = await pool.query(
            'SELECT * FROM conversations WHERE phone=$1 ORDER BY updated_at DESC LIMIT 1',
            [input.phone]
          );
          row = rows[0];
        }
        if (!row) return { success: false, message: 'No previous conversation found.' };
        return { success: true, messages: row.messages, patientData: row.patient_data };
      }

      case 'check_prescription_refill': {
        console.log(`💊 Refill: ${input.patient_name} - ${input.medication}`);
        return {
          success: true,
          message: `Refill request logged for ${input.medication}. Staff will contact ${input.patient_name} within 24 hours.`,
        };
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`Tool error [${toolName}]:`, err.message);
    return { success: false, message: 'A system error occurred. Please try again.' };
  }
}

module.exports = { executeTool, OFFICE_INFO };