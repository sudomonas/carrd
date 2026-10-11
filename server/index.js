// Production server: serves the built app from dist/ and the metadata API.
// Usage: npm run build && npm start   (PORT, HOST, TRUST_PROXY env vars)
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMetaHandler } from './meta.js';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const meta = createMetaHandler({ trustProxy: process.env.TRUST_PROXY === '1' });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function serveFile(res, file, cache) {
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': cache ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS,
  });
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (path === '/api/meta') return meta(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(400).end();
    return;
  }
  try {
    if (statSync(file).isFile()) return serveFile(res, file, path.startsWith('/assets/'));
  } catch {
    /* fall through to the SPA entry */
  }
  if (path.startsWith('/assets/') || path.startsWith('/api/')) {
    res.writeHead(404).end();
    return;
  }
  serveFile(res, join(root, 'index.html'), false);
});

server.listen(port, host, () => console.log(`carrd running at http://${host}:${port}`));
