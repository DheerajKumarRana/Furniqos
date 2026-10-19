// emailService.js - Lead Notification Email Dispatcher
const nodemailer = require('nodemailer');
require('dotenv').config();

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }
  return null;
}

async function sendLeadNotificationEmail(lead) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@furniqos.com';
  const transporter = createTransporter();

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #0E0D0C; color: #E8E2D9; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #181614; border: 1px solid #332C26; border-radius: 8px; overflow: hidden; }
        .header { background: #261F1A; padding: 24px; text-align: center; border-bottom: 1px solid #3D332B; }
        .logo { font-size: 24px; letter-spacing: 4px; font-weight: bold; color: #F8F5F0; text-transform: uppercase; }
        .subtitle { font-size: 12px; letter-spacing: 2px; color: #BAAFA4; margin-top: 6px; }
        .content { padding: 30px; }
        .badge { display: inline-block; padding: 4px 12px; background: #C8A27A; color: #181614; font-size: 11px; font-weight: bold; letter-spacing: 1px; border-radius: 20px; text-transform: uppercase; margin-bottom: 15px; }
        h2 { margin: 0 0 20px 0; font-size: 20px; color: #F8F5F0; }
        .field { margin-bottom: 16px; border-bottom: 1px solid #26211C; padding-bottom: 12px; }
        .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9A8E82; margin-bottom: 4px; }
        .value { font-size: 16px; color: #FFFFFF; }
        .value a { color: #D8B793; text-decoration: none; }
        .message-box { background: #211D19; padding: 16px; border-left: 3px solid #C8A27A; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #E0D9D0; }
        .footer { background: #12100E; padding: 16px; text-align: center; font-size: 12px; color: #7A7067; border-top: 1px solid #26211C; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">F U R N I Q O S</div>
          <div class="subtitle">LUXURY SOURCING & INTERIORS</div>
        </div>
        <div class="content">
          <span class="badge">New Inquiry Received</span>
          <h2>A new client inquiry has arrived from the website</h2>
          
          <div class="field">
            <div class="label">Full Name</div>
            <div class="value">${lead.name}</div>
          </div>
          <div class="field">
            <div class="label">Email Address</div>
            <div class="value"><a href="mailto:${lead.email}">${lead.email}</a></div>
          </div>
          <div class="field">
            <div class="label">Phone Number</div>
            <div class="value"><a href="tel:${lead.phone}">${lead.phone || 'Not provided'}</a></div>
          </div>
          <div class="field">
            <div class="label">Project Interest</div>
            <div class="value">${lead.project_type}</div>
          </div>
          <div class="field">
            <div class="label">Message / Space Requirements</div>
            <div class="message-box">${lead.message || 'No additional message provided.'}</div>
          </div>
          <div class="field">
            <div class="label">Received At</div>
            <div class="value">${new Date(lead.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div class="footer">
          FURNIQOS Lead Management System • Manage leads at <a href="http://localhost:${process.env.PORT || 3000}/admin" style="color:#C8A27A;">Admin Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log('\n[Email Notice] SMTP not configured. Here is the simulated email for lead:');
    console.log(`To: ${adminEmail}`);
    console.log(`Subject: [FURNIQOS Lead] New inquiry from ${lead.name} (${lead.project_type})`);
    console.log(`Lead details: Name: ${lead.name}, Email: ${lead.email}, Phone: ${lead.phone}, Type: ${lead.project_type}\n`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"FURNIQOS Leads" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      replyTo: lead.email,
      subject: `[FURNIQOS Lead] New ${lead.project_type} inquiry from ${lead.name}`,
      html: emailHtml
    });
    console.log('Lead notification email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Failed to send notification email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendLeadNotificationEmail };
