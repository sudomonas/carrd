// Metadata extraction from HTML without executing anything: a tolerant tag
// scanner over the document head. JSON-LD is parsed as data with JSON.parse.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', copy: '©' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s, max = 600) => {
  if (typeof s !== 'string') return null;
  const t = decodeEntities(s).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

function parseAttrs(tag) {
  const attrs = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

function safeUrl(value, base) {
  if (!value) return null;
  try {
    const u = new URL(decodeEntities(value.trim()), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function ldNodes(json) {
  const out = [];
  const visit = (n, depth) => {
    if (!n || typeof n !== 'object' || depth > 4) return;
    if (Array.isArray(n)) return n.forEach((x) => visit(x, depth + 1));
    out.push(n);
    if (n['@graph']) visit(n['@graph'], depth + 1);
  };
  visit(json, 0);
  return out;
}

const ARTICLE_TYPES = /Article|BlogPosting|NewsArticle|Report|WebPage|Posting/i;
const nameOf = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return nameOf(v[0]);
  return typeof v.name === 'string' ? v.name : null;
};
const imageOf = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return imageOf(v[0]);
  return typeof v.url === 'string' ? v.url : null;
};

/** Extracts card metadata from an HTML string fetched from `pageUrl`. */
export function extractMetadata(html, pageUrl) {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = html.slice(0, headEnd > 0 ? headEnd : 512 * 1024);
  const meta = {};
  const links = {};
  let titleTag = null;

  for (const m of head.matchAll(/<(meta|link)\b([^>]*)>/gi)) {
    const a = parseAttrs(m[2]);
    if (m[1].toLowerCase() === 'meta') {
      const key = (a.property || a.name || a.itemprop || '').toLowerCase();
      if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
    } else if (a.rel && a.href) {
      for (const rel of a.rel.toLowerCase().split(/\s+/)) if (!(rel in links)) links[rel] = a.href;
    }
  }
  const t = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (t) titleTag = t[1];

  let ld = {};
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const node = ldNodes(JSON.parse(m[1].trim())).find((n) => ARTICLE_TYPES.test([].concat(n['@type'] ?? []).join(' ')));
      if (node) {
        ld = node;
        break;
      }
    } catch {
      /* malformed JSON-LD is ignored */
    }
  }

  const authorMeta = meta.author || meta['article:author'];
  const author = clean(authorMeta && !/^https?:\/\//i.test(authorMeta) ? authorMeta : null, 120) || clean(nameOf(ld.author), 120);
  const host = new URL(pageUrl).hostname.replace(/^www\./, '');
  const canonical = safeUrl(links.canonical, pageUrl) || safeUrl(meta['og:url'], pageUrl) || pageUrl;

  return {
    url: pageUrl,
    canonicalUrl: canonical,
    title: clean(meta['og:title'] || meta['twitter:title'] || ld.headline || ld.name || titleTag, 300),
    description: clean(meta['og:description'] || meta['twitter:description'] || meta.description || ld.description, 1200),
    siteName: clean(meta['og:site_name'] || nameOf(ld.publisher) || meta['application-name'], 120) || host,
    author,
    publishedTime: clean(meta['article:published_time'] || ld.datePublished, 40),
    imageUrl: safeUrl(meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || imageOf(ld.image), pageUrl),
  };
}

/** Picks a text decoder label from Content-Type or a <meta charset>. */
export function detectCharset(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1];
  if (fromHeader) return fromHeader;
  const sniff = Buffer.from(bytes.subarray(0, 2048)).toString('latin1');
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1] || 'utf-8';
}
