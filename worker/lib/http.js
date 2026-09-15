// HTTP helper — native fetch + exponential backoff.
// Port dari mirror.js v2 (axios -> fetch), menjaga BROWSER_UA & mdaraHeaders.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';

function mdaraHeaders(referer = '') {
  return {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    ...(referer ? { Referer: referer } : {}),
  };
}

// Error dengan .status + .response.status (kompatibel kode lama).
class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.response = { status };
  }
}

async function httpFetch(url, { headers = {}, retries = 2, timeout = 20000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: { ...mdaraHeaders(url), ...headers },
        redirect: 'follow',
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (res.ok) return res;
      const err = new HttpError(`HTTP ${res.status} ${url}`, res.status);
      // 429 / 5xx: backoff (hormati Retry-After), 403 langsung dilempar (CF).
      if (res.status === 403) throw err;
      if ((res.status === 429 || res.status >= 500) && i < retries) {
        const ra = parseFloat(res.headers.get('retry-after') || '');
        const delay = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(30000, 2000 * Math.pow(2, i));
        await sleep(delay);
        continue;
      }
      if (i === retries) throw err;
      lastErr = err;
      await sleep(2000 * (i + 1));
    } catch (e) {
      clearTimeout(timer);
      if (e && e.status) throw e; // HttpError (403 sudah final / 429 final setelah retries)
      if (i === retries) throw e;
      lastErr = e;
      await sleep(3000 * (i + 1)); // network/timeout error -> backoff linear-exponential
    }
  }
  throw lastErr || new Error('fetch gagal: ' + url);
}

async function httpGet(url, opts = {}) {
  const res = await httpFetch(url, opts);
  return res.text();
}
async function httpGetJSON(url, opts = {}) {
  const res = await httpFetch(url, opts);
  return res.json();
}
async function httpGetBuffer(url, opts = {}) {
  const res = await httpFetch(url, opts);
  return Buffer.from(await res.arrayBuffer());
}
async function httpPost(url, body, { headers = {}, ...rest } = {}) {
  const res = await httpFetch(url, {
    ...rest,
    headers: { ...headers, ...(typeof body === 'string' ? {} : { 'content-type': 'application/json' }) },
  });
  return res;
}

module.exports = { httpFetch, httpGet, httpGetJSON, httpGetBuffer, httpPost, mdaraHeaders, BROWSER_UA, HttpError, sleep };
