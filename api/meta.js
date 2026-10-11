// Vercel serverless function: POST /api/meta — the same SSRF-hardened
// metadata handler that `npm start` and the Vite dev server mount.
import { createMetaHandler } from '../server/meta.js';

const handler = createMetaHandler({
  // Vercel sets x-real-ip to the client address (clients cannot spoof it).
  clientIp: (req) => String(req.headers['x-real-ip'] || '').trim() || null,
});

export default function meta(req, res) {
  return handler(req, res);
}
