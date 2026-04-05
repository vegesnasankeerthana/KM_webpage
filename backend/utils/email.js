const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function formatDate(dt) {
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

async function sendConfirmationEmail(toEmail, appt) {
  if (!process.env.SMTP_USER) {
    console.log('📧 Email skipped (no SMTP config):', toEmail, appt);
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;margin:0;padding:20px}
  .card{background:#fff;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px;text-align:center;color:#fff}
  .header h1{margin:0;font-size:22px;font-weight:700}
  .header p{margin:6px 0 0;opacity:.85;font-size:14px}
  .body{padding:28px}
  .check{font-size:48px;margin-bottom:8px}
  .detail-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
  .detail-row:last-child{border-bottom:none}
  .label{color:#64748b;font-weight:500}
  .value{color:#0f172a;font-weight:600;text-align:right;max-width:280px}
  .note{background:#eff6ff;border-radius:10px;padding:14px;font-size:13px;color:#1e40af;margin-top:20px;line-height:1.6}
  .footer{text-align:center;padding:20px;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9}
</style></head>
<body>
<div class="card">
  <div class="header">
    <div style="font-size:36px;margin-bottom:8px">🏥</div>
    <h1>Appointment Confirmed</h1>
    <p>Kyron Medical Group</p>
  </div>
  <div class="body">
    <div style="text-align:center;margin-bottom:20px">
      <div class="check">✅</div>
      <p style="font-size:16px;font-weight:600;color:#0f172a;margin:0">Hi ${appt.patientName}!</p>
      <p style="color:#64748b;font-size:14px;margin:4px 0 0">Your appointment has been confirmed.</p>
    </div>
    <div class="detail-row"><span class="label">Doctor</span><span class="value">${appt.doctorName}</span></div>
    <div class="detail-row"><span class="label">Specialty</span><span class="value">${appt.specialty}</span></div>
    <div class="detail-row"><span class="label">Date & Time</span><span class="value">${formatDate(appt.datetime)}</span></div>
    <div class="detail-row"><span class="label">Reason</span><span class="value">${appt.reason}</span></div>
    <div class="detail-row"><span class="label">Location</span><span class="value">${appt.address}</span></div>
    <div class="detail-row"><span class="label">Phone</span><span class="value">${appt.phone}</span></div>
    <div class="note">
      <strong>📋 Before your appointment:</strong><br>
      Please arrive 15 minutes early with your insurance card and photo ID.
      If you need to cancel or reschedule, please call us at least 24 hours in advance.
    </div>
  </div>
  <div class="footer">
    Kyron Medical Group · 123 Medical Center Drive, Suite 400, New York, NY 10001<br>
    This is an automated message. Do not reply to this email.
  </div>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${process.env.FROM_NAME || 'Kyron Medical'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: `✅ Appointment Confirmed — ${appt.doctorName} on ${formatDate(appt.datetime)}`,
    html,
  });
  console.log(`📧 Confirmation email sent to ${toEmail}`);
}

module.exports = { sendConfirmationEmail };
