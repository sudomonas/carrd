// Input adapters: raw user input (per input mode) -> normalized content.
import { normalizeContent, normalizeSourceUrl } from './document.js';
import { detectLanguage } from '../engine/code.js';

export const INPUT_MODES = [
  { id: 'text', label: 'Text' },
  { id: 'link', label: 'Link' },
  { id: 'image', label: 'Image' },
  { id: 'code', label: 'Code' },
  { id: 'list', label: 'List' },
];

export const EXCERPT_LIMIT = 280;

export function emptySource() {
  return {
    mode: 'text',
    text: { value: '', attribution: '', as: 'auto' },
    link: {
      url: '',
      status: 'idle', // idle | loading | done | error
      error: null,
      fetchedUrl: null,
      title: '',
      excerpt: '',
      excerptTrimmed: false,
      originalExcerpt: '',
      sourceName: '',
      author: '',
      canonicalUrl: null,
    },
    image: { caption: '', credit: '' },
    code: { value: '', language: 'auto', title: '' },
    list: { title: '', value: '' },
  };
}

/** Merges stored source state onto defaults, dropping anything malformed. */
export function normalizeSource(raw) {
  const base = emptySource();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, mode: INPUT_MODES.some((m) => m.id === raw.mode) ? raw.mode : 'text' };
  for (const key of ['text', 'link', 'image', 'code', 'list']) {
    const src = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
    out[key] = { ...base[key] };
    for (const field of Object.keys(base[key])) {
      const want = typeof base[key][field];
      if (src[field] === undefined) continue;
      if (want === 'string' && typeof src[field] === 'string') out[key][field] = src[field];
      else if (want === 'boolean' && typeof src[field] === 'boolean') out[key][field] = src[field];
      else if (base[key][field] === null && (typeof src[field] === 'string' || src[field] === null)) out[key][field] = src[field];
    }
  }
  // A fetch can't still be running after a reload.
  if (out.link.status === 'loading') out.link.status = 'idle';
  return out;
}

export function looksLikeUrl(s) {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return Boolean(normalizeSourceUrl(t));
  // Bare domains like "example.com/post" are treated as URLs too.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(t);
}

export function toAbsoluteUrl(s) {
  const t = s.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function looksLikeCode(s) {
  const lines = s.split('\n');
  if (lines.length < 2) return false;
  let signals = 0;
  if (/[{};]\s*$/m.test(s)) signals++;
  if (/^\s*(const|let|var|function|def|class|import|from|return|fn|pub|func|package|SELECT|#include)\b/m.test(s)) signals++;
  if (/=>|===|!==|::|->|:=/.test(s)) signals++;
  if (lines.filter((l) => /^( {2,}|\t)/.test(l)).length >= 2) signals++;
  return signals >= 2;
}

const QUOTE_PAIRS = [['“', '”'], ['"', '"'], ['«', '»'], ['„', '“'], ['‘', '’'], ["'", "'"]];
const ATTRIBUTION_LINE = /^\s*(?:—|–|--|―|~|-)\s*(.{1,80})$/;

/** Splits a trailing "— Name" line off a block of text. */
export function splitAttribution(text) {
  const lines = text.trim().split('\n');
  if (lines.length > 1) {
    const m = lines[lines.length - 1].match(ATTRIBUTION_LINE);
    if (m) return { text: lines.slice(0, -1).join('\n').trim(), attribution: m[1].trim() };
  }
  // Same-line form: “Quote.” — Name
  const inline = text.trim().match(/^([“"«„‘'].+[”"»“’'])\s+(?:—|–|--|―|~)\s*(.{1,80})$/s);
  if (inline) return { text: inline[1], attribution: inline[2].trim() };
  return { text: text.trim(), attribution: null };
}

function stripQuoteMarks(text) {
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.length > 2 && text.startsWith(open) && text.endsWith(close)) {
      return { text: text.slice(open.length, -close.length).trim(), quoted: true };
    }
  }
  return { text, quoted: false };
}

/**
 * Interprets free text as either a quote or a post (optional title + body).
 * `as` may force 'quote' or 'post'; 'auto' applies these rules:
 *  - wrapped in quotation marks, or carrying an attribution -> quote
 *  - otherwise -> post; a short first line followed by more text becomes the title.
 */
export function parseText(value, attributionField = '', as = 'auto') {
  const split = splitAttribution(value);
  const attribution = attributionField.trim() || split.attribution;
  const stripped = stripQuoteMarks(split.text);
  const kind = as === 'quote' || (as === 'auto' && (stripped.quoted || Boolean(attribution) && split.text.length <= 400))
    ? 'quote'
    : 'text';

  if (kind === 'quote') {
    return { kind, quote: stripped.text, attribution };
  }
  const text = split.text;
  const paragraphs = text.split(/\n\s*\n/);
  const lines = text.split('\n');
  let title = '';
  let body = text;
  if (lines.length > 1 && lines[0].trim().length <= 140 && text.length - lines[0].length > 20) {
    title = lines[0].trim().replace(/^#+\s*/, '');
    body = lines.slice(1).join('\n').trim();
  } else if (paragraphs.length === 1 && /^#+\s/.test(text)) {
    title = text.replace(/^#+\s*/, '');
    body = '';
  }
  return { kind, title, body, attribution };
}

/**
 * Excerpt policy for article cards: descriptions longer than EXCERPT_LIMIT are
 * cut at the last sentence boundary that fits (or a word boundary with an
 * ellipsis). The UI flags trimmed excerpts and leaves them editable.
 */
export function makeExcerpt(text, limit = EXCERPT_LIMIT) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= limit) return { excerpt: t, trimmed: false };
  const head = t.slice(0, limit);
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentenceEnd > limit * 0.45) return { excerpt: head.slice(0, sentenceEnd + 1), trimmed: true };
  const space = head.lastIndexOf(' ');
  return { excerpt: `${head.slice(0, space > 0 ? space : limit).replace(/[,;:.\s]+$/, '')}…`, trimmed: true };
}

export function parseListItems(value) {
  return value
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•·–]|\d{1,3}[.)])\s+/, '').trim())
    .filter(Boolean);
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Builds normalized content from the active input mode.
 * `assets` holds image metadata: { upload, link } -> { width, height } | null.
 */
export function sourceToContent(source, assets = {}) {
  const img = (id, meta, alt) => (meta ? { assetId: id, width: meta.width, height: meta.height, alt } : null);
  switch (source.mode) {
    case 'link': {
      const l = source.link;
      const url = l.canonicalUrl || (l.url.trim() && looksLikeUrl(l.url) ? toAbsoluteUrl(l.url) : null);
      return normalizeContent({
        kind: 'article',
        title: l.title,
        body: l.excerpt,
        author: l.author,
        sourceName: l.sourceName || (url ? hostname(url) : null),
        sourceUrl: url,
        image: img('link', assets.link, l.title),
      });
    }
    case 'image': {
      const i = source.image;
      return normalizeContent({
        kind: 'image',
        title: i.caption,
        attribution: i.credit,
        image: img('upload', assets.upload, i.caption),
      });
    }
    case 'code': {
      const c = source.code;
      const language = c.language === 'auto' ? detectLanguage(c.value) : c.language;
      return normalizeContent({ kind: 'code', title: c.title, body: c.value, codeLanguage: language });
    }
    case 'list': {
      const l = source.list;
      return normalizeContent({ kind: 'list', title: l.title, items: parseListItems(l.value) });
    }
    default: {
      const t = source.text;
      return normalizeContent(parseText(t.value, t.attribution, t.as));
    }
  }
}
