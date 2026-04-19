const nodemailer = require('nodemailer');

function createTransport() {
  // Support multiple email providers
  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  
  if (provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  
  if (provider === 'sendgrid') {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net', port: 587, secure: false,
      auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY },
    });
  }
  
  if (provider === 'resend') {
    return nodemailer.createTransport({
      host: 'smtp.resend.com', port: 465, secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    });
  }
  
  if (provider === 'brevo') {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com', port: 587, secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.BREVO_API_KEY },
    });
  }

  // Generic SMTP fallback
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

const FROM_NAME    = process.env.EMAIL_FROM_NAME || 'AKIRAREADS';
const FROM_ADDRESS = process.env.EMAIL_USER || 'noreply@akirareads.com';
const SITE_URL     = process.env.CLIENT_URL || 'http://localhost:3000';

async function sendVerificationEmail(email, username, token) {
  if (!process.env.EMAIL_USER) {
    console.warn('⚠️  EMAIL_USER not set — skipping email send, token:', token);
    return; // Skip in dev
  }
  
  const verifyUrl = `${SITE_URL}/verify-email?token=${token}`;
  const transport = createTransport();
  
  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to: email,
    subject: `Verifikasi Email - ${FROM_NAME}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" style="background:#141420;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);">
        <tr><td style="padding:32px;text-align:center;background:#0f0f1a;">
          <div style="font-size:32px;font-weight:900;letter-spacing:4px;color:#fff;">
            AKIRAREADS<span style="color:#e11d48;">.</span>
          </div>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h2 style="color:#fff;margin:0 0 16px;font-size:22px;">Verifikasi Email Kamu 📧</h2>
          <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;line-height:1.7;">
            Halo <strong style="color:#fff;">${username}</strong>! Terima kasih telah mendaftar di AKIRAREADS.<br/>
            Klik tombol di bawah untuk memverifikasi email kamu:
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${verifyUrl}" style="background:#e11d48;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              ✅ Verifikasi Email
            </a>
          </div>
          <p style="color:rgba(255,255,255,0.3);font-size:13px;margin:0;">
            Link berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar, abaikan email ini.<br/><br/>
            Atau copy link ini: <br/>
            <span style="color:#e11d48;word-break:break-all;font-size:12px;">${verifyUrl}</span>
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">
            © ${new Date().getFullYear()} AKIRAREADS — Platform Baca Manhwa Terbaik
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

async function sendPasswordResetEmail(email, username, token) {
  if (!process.env.EMAIL_USER) {
    console.warn('⚠️  EMAIL_USER not set — reset token:', token);
    return;
  }
  
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
  const transport = createTransport();
  
  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to: email,
    subject: `Reset Password - ${FROM_NAME}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" style="background:#141420;border-radius:16px;border:1px solid rgba(255,255,255,0.05);">
        <tr><td style="padding:32px;text-align:center;background:#0f0f1a;">
          <div style="font-size:32px;font-weight:900;letter-spacing:4px;color:#fff;">
            AKIRAREADS<span style="color:#e11d48;">.</span>
          </div>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h2 style="color:#fff;margin:0 0 16px;">Reset Password 🔑</h2>
          <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;line-height:1.7;">
            Halo <strong style="color:#fff;">${username}</strong>!<br/>
            Kamu meminta reset password. Klik tombol di bawah:
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:#e11d48;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              🔑 Reset Password
            </a>
          </div>
          <p style="color:rgba(255,255,255,0.3);font-size:13px;">
            Link berlaku <strong>1 jam</strong>. Jika kamu tidak meminta reset, abaikan email ini.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
