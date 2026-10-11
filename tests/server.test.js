import { describe, it, expect } from 'vitest';
import { isPublicIp, expandIPv6 } from '../server/ip.js';
import { validateUrl, resolvePublic } from '../server/fetch.js';
import { extractMetadata, decodeEntities } from '../server/parse.js';
import { createRateLimiter, sniffImageType } from '../server/meta.js';

describe('IP classification', () => {
  const blocked = ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a00:1', '2001:db8::1', '2002:c0a8:101::1', '2001::1'];
  const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4001::200e', '::ffff:8.8.8.8'];
  for (const ip of blocked) it(`blocks ${ip}`, () => expect(isPublicIp(ip)).toBe(false));
  for (const ip of allowed) it(`allows ${ip}`, () => expect(isPublicIp(ip)).toBe(true));
  it('expands compressed IPv6', () => {
    expect(expandIPv6('2001:db8::1')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(expandIPv6('1:2:3')).toBeNull();
  });
});

describe('URL validation', () => {
  const bad = ['ftp://example.com', 'file:///etc/passwd', 'http://user:pw@example.com', 'http://localhost/', 'http://foo.localhost/', 'http://printer.local/', 'http://intranet/', 'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'http://[::1]/', 'http://example.com:8080/', 'javascript:alert(1)', 'http://169.254.169.254/latest/meta-data'];
  for (const u of bad) it(`rejects ${u}`, () => expect(() => validateUrl(u)).toThrow());
  it('accepts normal https URLs and strips fragments', () => {
    expect(validateUrl('https://example.com/a?b=1#frag').href).toBe('https://example.com/a?b=1');
  });
  it('re-validates relative redirects against the base', () => {
    expect(() => validateUrl('http://10.0.0.1/x', 'https://example.com/')).toThrow();
    expect(validateUrl('/next', 'https://example.com/a').href).toBe('https://example.com/next');
  });
});

describe('DNS checks', () => {
  it('rejects hostnames resolving to any private address (rebinding-style answers)', async () => {
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }];
    await expect(resolvePublic('evil.example', lookup)).rejects.toMatchObject({ code: 'blocked' });
  });
  it('returns a public address to pin the connection to', async () => {
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
    await expect(resolvePublic('ok.example', lookup)).resolves.toEqual({ address: '93.184.216.34', family: 4 });
  });
});

describe('metadata parsing', () => {
  const html = `<!doctype html><html><head>
    <title>Fallback &amp; title</title>
    <meta property="og:title" content="The &quot;Real&quot; Title">
    <meta name="description" content="A description.">
    <meta property="og:site_name" content="Example Times">
    <meta property="og:image" content="/img/cover.jpg">
    <link rel="canonical" href="https://example.com/canonical">
    <script>alert('never run')</script>
    <script type="application/ld+json">{"@type":"NewsArticle","author":{"name":"Grace Hopper"},"datePublished":"2024-01-02"}</script>
    </head><body><meta property="og:title" content="ignored body tag"></body></html>`;
  it('extracts Open Graph, standard meta, canonical and JSON-LD', () => {
    const m = extractMetadata(html, 'https://example.com/post');
    expect(m).toMatchObject({
      title: 'The "Real" Title',
      description: 'A description.',
      siteName: 'Example Times',
      author: 'Grace Hopper',
      canonicalUrl: 'https://example.com/canonical',
      imageUrl: 'https://example.com/img/cover.jpg',
      publishedTime: '2024-01-02',
    });
  });
  it('falls back gracefully when metadata is missing', () => {
    const m = extractMetadata('<html><head></head></html>', 'https://www.site.org/x');
    expect(m.title).toBeNull();
    expect(m.siteName).toBe('site.org');
    expect(m.imageUrl).toBeNull();
  });
  it('rejects non-http image and canonical URLs', () => {
    const m = extractMetadata('<head><meta property="og:image" content="javascript:alert(1)"><link rel="canonical" href="data:text/html,x"></head>', 'https://a.com/');
    expect(m.imageUrl).toBeNull();
    expect(m.canonicalUrl).toBe('https://a.com/');
  });
  it('decodes entities safely', () => {
    expect(decodeEntities('&#x41;&#66;&amp;&bogus;&#0;')).toBe('AB&&bogus;');
  });
});

describe('service guards', () => {
  it('rate limits per client', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true]);
  });
  it('sniffs real image bytes', () => {
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/png');
    expect(sniffImageType(Buffer.from('<html><body>not an image</body></html>'))).toBeNull();
  });
});

describe('serverless request shapes', () => {
  const fakeRes = () => {
    const res = { headers: {}, statusCode: 0, body: '' };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.end = (b) => { res.body = b; res.done(); };
    res.finished = new Promise((r) => { res.done = r; });
    return res;
  };

  it('accepts a body the platform already parsed, and rejects bad URLs', async () => {
    const { createMetaHandler } = await import('../server/meta.js');
    const handler = createMetaHandler({ clientIp: () => 'test' });
    const res = fakeRes();
    handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { url: 'ftp://example.com' } }, res);
    await res.finished;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ ok: false, code: 'invalid_url' });
  });

  it('blocks internal addresses from a parsed body too', async () => {
    const { createMetaHandler } = await import('../server/meta.js');
    const handler = createMetaHandler({ clientIp: () => 'test2' });
    const res = fakeRes();
    handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'http://169.254.169.254/' }) }, res);
    await res.finished;
    expect(res.statusCode).toBe(422);
  });
});
