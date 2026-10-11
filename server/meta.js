// POST /api/meta { url } -> { ok, meta } — link metadata for article cards.
// Not a proxy: it returns only extracted metadata plus, when present, the
// page's preview image (validated image bytes, size-capped).
import { safeFetch, FetchError } from './fetch.js';
import { extractMetadata, detectCharset } from './parse.js';

const HTML_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 4 * 1024 * 1024;
const BODY_LIMIT = 4096;

const MESSAGES = {
  invalid_url: 'Enter a valid http or https address.',
  blocked: 'That address can’t be fetched. Fill in the details manually.',
  rate_limited: 'Too many link requests. Wait a minute and try again.',
  busy: 'The link service is busy. Try again in a moment.',
  default: 'We couldn’t read that page. Fill in the details manually.',
};
const STATUS = { invalid_url: 400, blocked: 422, rate_limited: 429, busy: 503 };

const IMAGE_SIGNATURES = [
  ['image/png', (b) => b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG'],
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/gif', (b) => b.subarray(0, 4).toString('latin1') === 'GIF8'],
  ['image/webp', (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'],
  ['image/avif', (b) => b.subarray(4, 12).toString('latin1').startsWith('ftypavi')],
];

export function sniffImageType(buf) {
  return IMAGE_SIGNATURES.find(([, test]) => buf.length > 12 && test(buf))?.[0] ?? null;
}

/** Sliding-window limiter keyed by client address. */
export function createRateLimiter({ limit = 20, windowMs = 60_000 } = {}) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(body);
}

const fail = (res, code) => send(res, STATUS[code] ?? 502, { ok: false, code, error: MESSAGES[code] ?? MESSAGES.default });

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        reject(new FetchError('invalid_url'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new FetchError('invalid_url'));
      }
    });
    req.on('error', reject);
  });
}

export async function fetchMetadata(url, { lookup } = {}) {
  const page = await safeFetch(url, {
    accept: (t) => t.startsWith('text/html') || t.startsWith('application/xhtml+xml'),
    maxBytes: HTML_LIMIT,
    timeoutMs: 8000,
    lookup,
  });
  const html = new TextDecoder(detectCharset(page.contentType, page.body), { fatal: false }).decode(page.body);
  const meta = extractMetadata(html, page.url);
  let image = null;
  if (meta.imageUrl) {
    try {
      const img = await safeFetch(meta.imageUrl, {
        accept: (t) => /^image\/(png|jpeg|jpg|gif|webp|avif)\b/.test(t),
        maxBytes: IMAGE_LIMIT,
        timeoutMs: 6000,
        lookup,
      });
      const type = sniffImageType(img.body);
      if (type) image = { type, data: img.body.toString('base64') };
    } catch {
      /* the thumbnail is optional */
    }
  }
  const { imageUrl, ...rest } = meta;
  return { ...rest, image };
}

/**
 * Connect-style handler (works in the Vite dev server and plain node:http).
 * options.trustProxy: use the first X-Forwarded-For hop as the client key.
 */
export function createMetaHandler({ trustProxy = false, limit = 20, maxConcurrent = 8, log = console } = {}) {
  const allow = createRateLimiter({ limit });
  let active = 0;
  return async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return send(res, 405, { ok: false, error: 'Method not allowed.' });
    }
    if (!String(req.headers['content-type'] || '').includes('application/json')) return fail(res, 'invalid_url');
    const client = (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
    if (!allow(client)) return fail(res, 'rate_limited');
    if (active >= maxConcurrent) return fail(res, 'busy');
    active++;
    try {
      const body = await readJson(req);
      if (typeof body?.url !== 'string' || body.url.length > 2048) throw new FetchError('invalid_url');
      const meta = await fetchMetadata(body.url.trim());
      send(res, 200, { ok: true, meta });
    } catch (e) {
      const code = e instanceof FetchError ? e.code : 'internal';
      if (!(e instanceof FetchError)) log.error?.('[meta] unexpected error', e);
      fail(res, code === 'invalid_url' || code === 'blocked' ? code : 'default');
    } finally {
      active--;
    }
  };
}
