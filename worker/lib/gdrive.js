// Auth service account Google via JWT RS256 murni `crypto` (tanpa googleapis).
// GOOGLE_SA_JSON = base64 dari file JSON SA. Token dicache 50 menit.
const crypto = require('crypto');
const env = require('./env');

let cache = { token: null, exp: 0 };

function loadSa() {
  const raw = env('GOOGLE_SA_JSON');
  if (!raw) return null;
  try {
    let json = raw;
    // Base64 (dari Railway dashboard) ATAU JSON mentah.
    if (!raw.trim().startsWith('{')) json = Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(json);
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeAssertion(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signing = head + '.' + claims;
  const sig = crypto.createSign('RSA-SHA256').update(signing).sign(sa.private_key);
  return signing + '.' + b64url(sig);
}

// getToken(force?) -> 'ya29...' atau null bila SA tidak dikonfigurasi.
async function getToken() {
  if (cache.token && Date.now() < cache.exp) return cache.token;
  const sa = loadSa();
  if (!sa) return null;
  const assertion = makeAssertion(sa);
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) throw new Error('GDrive token gagal: HTTP ' + res.status + ' ' + (await res.text().catch(() => '')).substring(0, 200));
  const j = await res.json();
  cache = { token: j.access_token, exp: Date.now() + 50 * 60 * 1000 }; // 50 menit
  return cache.token;
}

function isConfigured() {
  return Boolean(loadSa() && env('GDRIVE_FOLDER_ID'));
}

module.exports = { getToken, isConfigured, loadSa };
