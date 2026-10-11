// Language detection and a small, restrained tokenizer for syntax colouring.
// Tokens always concatenate back to the exact source line.

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C / C++' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
  { id: 'sql', label: 'SQL' },
  { id: 'shell', label: 'Shell' },
  { id: 'json', label: 'JSON' },
  { id: 'plain', label: 'Plain text' },
];

const KEYWORDS = {
  javascript: 'async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield null undefined true false',
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self',
  rust: 'as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
  java: 'abstract boolean break case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while true false',
  c: 'auto break case char const continue default do double else enum extern float for goto if int long return short signed sizeof static struct switch typedef union unsigned void volatile while class namespace template public private include define nullptr true false',
  css: '',
  sql: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as distinct null is in like between case when then else end',
  shell: 'if then else elif fi for while do done case esac function in echo export local return sudo cd',
  json: 'true false null',
};
KEYWORDS.typescript = `${KEYWORDS.javascript} interface type enum implements private public readonly declare namespace abstract as`;

export function detectLanguage(code) {
  const s = code;
  if (!s.trim()) return null;
  const t = s.trim();
  const tests = [
    ['json', () => /^[[{]/.test(t) && (() => { try { JSON.parse(t); return true; } catch { return false; } })()],
    ['html', () => /^<(!doctype|html|div|span|section|p|a|ul|head|body|template)\b/i.test(t)],
    ['rust', () => /\bfn\s+\w+\s*\(|\blet\s+mut\b|::\w+|println!/.test(s)],
    ['go', () => /\bfunc\s+\w*\s*\(|\bpackage\s+\w+|:=/.test(s) && !/\bconst\b|=>/.test(s)],
    ['python', () => /^\s*(def|class)\s+\w+.*:\s*$/m.test(s) || /^\s*(from\s+\S+\s+)?import\s+\w+\s*$/m.test(s) && !/;\s*$/m.test(s) || /\bprint\(/.test(s) && !/;\s*$/m.test(s)],
    ['typescript', () => /:\s*(string|number|boolean|void|unknown|any)\b|\binterface\s+\w+|\btype\s+\w+\s*=/.test(s)],
    ['javascript', () => /\b(const|let|function|=>|console\.|require\(|export\s+default)\b|=>/.test(s)],
    ['java', () => /\bpublic\s+(static\s+)?(class|void)\b|System\.out/.test(s)],
    ['c', () => /#include\s*<|\bint\s+main\s*\(|std::/.test(s)],
    ['sql', () => /^\s*(select|insert|update|delete|create|with)\b/im.test(t) && /\b(from|into|table|set)\b/i.test(s)],
    ['css', () => /^[^{]+\{\s*[\w-]+\s*:\s*[^;]+;/m.test(s)],
    ['shell', () => /^(\$\s|#!\/bin\/(ba)?sh|sudo |npm |git |cd |ls |echo )/m.test(t)],
  ];
  for (const [id, test] of tests) if (test()) return id;
  return 'plain';
}

export function languageLabel(id) {
  return LANGUAGES.find((l) => l.id === id)?.label ?? null;
}

const COMMENT = {
  python: /#.*/y, shell: /#.*/y, sql: /--.*/y,
  javascript: /\/\/.*/y, typescript: /\/\/.*/y, rust: /\/\/.*/y, go: /\/\/.*/y, java: /\/\/.*/y, c: /\/\/.*/y,
  css: /\/\*.*?(\*\/|$)/y, html: /<!--.*?(-->|$)/y,
};

/**
 * Tokenizes one line into [{ text, type }] where type is one of
 * plain | keyword | string | comment | number | punct.
 * Block comments spanning lines are not tracked (kept deliberately simple).
 */
export function tokenizeLine(line, language) {
  const lang = language && KEYWORDS[language] !== undefined ? language : language === 'html' ? 'html' : null;
  if (!lang) return line ? [{ text: line, type: 'plain' }] : [];
  const kw = new Set((KEYWORDS[lang] ?? '').split(' ').filter(Boolean));
  const caseInsensitive = lang === 'sql';
  const tokens = [];
  const push = (text, type) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.text += text;
    else tokens.push({ text, type });
  };
  let i = 0;
  const commentRe = COMMENT[lang];
  while (i < line.length) {
    if (commentRe) {
      commentRe.lastIndex = i;
      const m = commentRe.exec(line);
      if (m && m.index === i && m[0].length) { push(m[0], 'comment'); i += m[0].length; continue; }
    }
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      push(line.slice(i, Math.min(j + 1, line.length)), 'string');
      i = Math.min(j + 1, line.length);
      continue;
    }
    if (/[0-9]/.test(ch) && !/[\w$]/.test(line[i - 1] ?? '')) {
      const m = /^(0x[\da-f]+|\d[\d_]*(\.\d+)?(e[+-]?\d+)?)/i.exec(line.slice(i));
      push(m[0], 'number'); i += m[0].length; continue;
    }
    if (/[A-Za-z_$@]/.test(ch)) {
      const m = /^[A-Za-z_$@][\w$-]*/.exec(line.slice(i));
      let word = m[0];
      if (lang !== 'css' && lang !== 'html') word = /^[A-Za-z_$@][\w$]*/.exec(word)[0];
      const isKw = kw.has(caseInsensitive ? word.toLowerCase() : word);
      push(word, isKw ? 'keyword' : 'plain'); i += word.length; continue;
    }
    if (/[{}()[\];,.<>=+\-*/%!&|^~?:]/.test(ch)) { push(ch, 'punct'); i++; continue; }
    push(ch, 'plain'); i++;
  }
  return tokens;
}
