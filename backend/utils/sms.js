require('dotenv').config();

async function sendSMSConfirmation(toPhone, appt) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('📱 SMS skipped (no Twilio config):', toPhone);
    return;
  }

  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const dt = new Date(appt.datetime).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });

  const body =
    `✅ Kyron Medical: Appt confirmed!\n` +
    `${appt.patientName} with ${appt.doctorName}\n` +
    `📅 ${dt}\n` +
    `📍 123 Medical Center Dr, Suite 400, NY\n` +
    `Questions? Call (212) 555-0100`;

  await twilio.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   toPhone,
  });
  console.log(`📱 SMS confirmation sent to ${toPhone}`);
}

module.exports = { sendSMSConfirmation };
