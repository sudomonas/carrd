// SSRF-hardened HTTP(S) fetcher used by the metadata service.
//  - http/https only, default ports only, no credentials in URLs
//  - hostnames resolved up front; every resolved address must be public
//  - the socket connects to the *validated* address (pinned lookup), which
//    defeats DNS rebinding between the check and the connection
//  - redirects are followed manually, re-validated hop by hop, and capped
//  - total deadline, response size cap (after decompression), type checks
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import zlib from 'node:zlib';
import { isPublicIp } from './ip.js';

export class FetchError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail; // for server logs only, never sent to clients
  }
}

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home.arpa', '.localdomain', '.corp'];

/** Parses and validates a user-supplied URL. Throws FetchError. */
export function validateUrl(input, base) {
  let url;
  try {
    url = new URL(input, base);
  } catch {
    throw new FetchError('invalid_url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchError('invalid_url', 'protocol');
  if (url.username || url.password) throw new FetchError('invalid_url', 'credentials');
  if (url.port && !['80', '443'].includes(url.port)) throw new FetchError('blocked', 'port');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host) throw new FetchError('invalid_url');
  if (net.isIP(host)) {
    if (!isPublicIp(host)) throw new FetchError('blocked', 'ip literal');
  } else {
    if (host === 'localhost' || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new FetchError('blocked', 'hostname');
    if (!host.includes('.')) throw new FetchError('blocked', 'single-label host');
  }
  url.hash = '';
  return url;
}

/** Resolves a hostname and returns one address, requiring *all* to be public. */
export async function resolvePublic(hostname, lookup = dns.lookup) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (!isPublicIp(host)) throw new FetchError('blocked', 'ip');
    return { address: host, family: net.isIP(host) };
  }
  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch (e) {
    throw new FetchError('dns', e.code);
  }
  if (!records.length) throw new FetchError('dns', 'no records');
  if (records.some((r) => !isPublicIp(r.address))) throw new FetchError('blocked', 'resolved to non-public address');
  return records[0];
}

function request(url, pinned, deadline) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new FetchError('timeout'));
    const req = mod.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent: false,
        servername: net.isIP(url.hostname) ? undefined : url.hostname,
        headers: {
          'user-agent': 'carrd-metadata/0.1 (+link previews)',
          accept: 'text/html,application/xhtml+xml;q=0.9,image/*;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en;q=0.9,*;q=0.5',
        },
        // Pin the connection to the address we validated.
        lookup: (_host, opts, cb) => {
          if (opts && opts.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
          else cb(null, pinned.address, pinned.family);
        },
      },
      resolve,
    );
    req.setTimeout(remaining, () => req.destroy(new FetchError('timeout')));
    req.on('error', (e) => reject(e instanceof FetchError ? e : new FetchError('network', e.code)));
    req.end();
  });
}

function readBody(res, maxBytes, deadline) {
  return new Promise((resolve, reject) => {
    const enc = String(res.headers['content-encoding'] || '').toLowerCase();
    let stream = res;
    if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
    else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
    else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
    else if (enc && enc !== 'identity') return reject(new FetchError('encoding', enc));

    const declared = Number(res.headers['content-length']);
    if (!enc && declared > maxBytes) {
      res.destroy();
      return reject(new FetchError('too_large'));
    }
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => fail(new FetchError('timeout')), Math.max(0, deadline - Date.now()));
    const fail = (e) => {
      clearTimeout(timer);
      res.destroy();
      if (stream !== res) stream.destroy();
      reject(e instanceof FetchError ? e : new FetchError('network', e?.code));
    };
    stream.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) fail(new FetchError('too_large'));
      else chunks.push(c);
    });
    stream.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    stream.on('error', fail);
  });
}

/**
 * Fetches a public URL.
 * opts: { accept: (contentType) => boolean, maxBytes, timeoutMs, maxRedirects, lookup }
 * Returns { url, contentType, body }.
 */
export async function safeFetch(input, opts) {
  const { accept, maxBytes, timeoutMs = 8000, maxRedirects = 4, lookup } = opts;
  const deadline = Date.now() + timeoutMs;
  let url = validateUrl(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const pinned = await resolvePublic(url.hostname, lookup);
    const res = await request(url, pinned, deadline);
    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
      res.resume();
      const location = res.headers.location;
      if (!location) throw new FetchError('http_status', 'redirect without location');
      url = validateUrl(location, url);
      continue;
    }
    if (res.statusCode !== 200) {
      res.resume();
      throw new FetchError('http_status', res.statusCode);
    }
    const contentType = String(res.headers['content-type'] || '').toLowerCase();
    if (!accept(contentType)) {
      res.destroy();
      throw new FetchError('content_type', contentType);
    }
    const body = await readBody(res, maxBytes, deadline);
    return { url: url.href, contentType, body };
  }
  throw new FetchError('redirects');
}
