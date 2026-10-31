// Markdown for chat messages, as data. parseMarkdown() turns a message into
// a small tree of blocks and inline nodes that the components render with
// their framework's elements, so a message never becomes HTML: raw HTML in a
// message stays visible text.
//
// Blocks: paragraphs (single line breaks kept, as typed in a chat), ```
// fenced code, # headings, > quotes, - * + and 1. lists (nested by indent),
// pipe tables and --- rules. Inline: `code`, **bold**, *italic*, ~~strike~~,
// [links](url), bare https:// and www. links, and ![images](url).
//
// Only http(s), mailto and same-site paths become links (no javascript:,
// data:, //host). Images are kept inline only from the allowed origins
// (by default the page's own); any other image becomes a link to it, so a
// message cannot make the reader's browser fetch a third-party URL.

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const QUOTE = /^ {0,3}>\s?/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP = /^(?=.*\|)\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const MAX_DEPTH = 4;

const cells = (line) => {
  const s = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
};

const startsBlock = (line, next) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  QUOTE.test(line) ||
  ITEM.test(line) ||
  RULE.test(line) ||
  (line.includes('|') && next !== undefined && TABLE_SEP.test(next));

/**
 * Whether a link target is safe to follow: http(s), mailto, or a path on
 * the same site. Returns the normalized target, or null.
 */
export function safeHref(url) {
  const u = String(url).trim();
  if (/^\/(?!\/)/.test(u) || u.startsWith('#')) return u;
  if (/^(https?:\/\/|mailto:)/i.test(u)) {
    try {
      const parsed = new URL(u);
      return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
      return null;
    }
  }
  return null;
}

function pageOrigin() {
  return typeof location === 'undefined' ? '' : location.origin;
}

/** The address an image may load from, or null when it must stay a link. */
export function imageSrc(url, options = {}) {
  const href = safeHref(url);
  if (!href || href.startsWith('mailto:') || href.startsWith('#')) return null;
  const origin = options.origin ?? pageOrigin();
  const allowed = [origin, ...(options.imageOrigins ?? [])].filter(Boolean);
  if (!allowed.length) return null;
  try {
    const parsed = new URL(href, origin || undefined);
    return allowed.includes(parsed.origin) || allowed.includes('*') ? parsed.href : null;
  } catch {
    return null;
  }
}

function hostOf(href) {
  try {
    return new URL(href).host || href;
  } catch {
    return href;
  }
}

const LINK_TARGET = String.raw`<?([^\s()<>]+(?:\([^\s()]*\)[^\s()<>]*)*)>?(?:\s+"[^"\n]*")?\s*\)`;
const BARE_URL = /^(?:https?:\/\/|www\.)[^\s<>]*[^\s<>.,:;!?'")\]}。、，！？）」』]/i;

function autolink(url) {
  // Keep a closing parenthesis only when the URL opened one.
  let u = url;
  while (u.endsWith(')') && (u.match(/\(/g)?.length ?? 0) < (u.match(/\)/g)?.length ?? 0)) u = u.slice(0, -1);
  const href = safeHref(/^www\./i.test(u) ? 'https://' + u : u);
  return { node: href ? { type: 'link', href, children: [u] } : u, length: u.length };
}

function inlineRules(options) {
  return [
    [/^\\([\\`*_{}[\]()#+\-.!|~>])/, (m) => m[1]],
    [/^(`+)([\s\S]+?)\1(?!`)/, (m) => ({ type: 'code', text: m[2].replace(/^ (.*) $/, '$1') })],
    [
      new RegExp(String.raw`^!\[([^\]\n]*)\]\(\s*` + LINK_TARGET),
      (m) => {
        const src = imageSrc(m[2], options);
        if (src) return { type: 'image', src, alt: m[1] };
        const href = safeHref(m[2]);
        return href ? { type: 'imagelink', href, alt: m[1] || hostOf(href) } : m[0];
      },
    ],
    [
      new RegExp(String.raw`^\[((?:\\.|` + '`[^`]*`' + String.raw`|[^\]\\])+)\]\(\s*` + LINK_TARGET),
      (m) => {
        const href = safeHref(m[2]);
        const children = parseInline(m[1], options);
        return href ? { type: 'link', href, children } : { type: 'span', children };
      },
    ],
    [/^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i, (m) => autolink(m[1]).node],
    [/^(\*\*|__)(?=\S)([\s\S]*?\S)\1(?![*_])/, (m) => ({ type: 'strong', children: parseInline(m[2], options) })],
    [/^~~(?=\S)([\s\S]*?\S)~~/, (m) => ({ type: 'del', children: parseInline(m[1], options) })],
    [/^\*(?=[^\s*])((?:\*\*[\s\S]+?\*\*|[^*])*?[^\s*])\*(?!\*)/, (m) => ({ type: 'em', children: parseInline(m[1], options) })],
    [/^_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/u, (m) => ({ type: 'em', children: parseInline(m[1], options) })],
  ];
}

/** Inline Markdown in one line of text, as nodes (strings are plain text). */
export function parseInline(text, options = {}) {
  const rules = inlineRules(options);
  const out = [];
  let plain = '';
  let i = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = '';
  };
  while (i < text.length) {
    const rest = text.slice(i);
    const c = rest[0];
    if ('\\`![<*_~'.includes(c)) {
      // An underscore inside a word (snake_case) is just text.
      if (c === '_' && i > 0 && /[\p{L}\p{N}]/u.test(text[i - 1])) {
        plain += c;
        i++;
        continue;
      }
      let matched = false;
      for (const [re, make] of rules) {
        const m = re.exec(rest);
        if (m) {
          flush();
          out.push(make(m));
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (matched) continue;
    } else if ('hHwW'.includes(c) && (i === 0 || /[\s(（「『【[*_~]/.test(text[i - 1]))) {
      const m = BARE_URL.exec(rest);
      if (m) {
        flush();
        const { node, length } = autolink(m[0]);
        out.push(node);
        i += length;
        continue;
      }
    }
    plain += c;
    i++;
  }
  flush();
  return out;
}

/** Inline text that keeps the message's own line breaks. */
function withBreaks(text, options) {
  const out = [];
  text.split('\n').forEach((line, j) => {
    if (j > 0) out.push({ type: 'br' });
    out.push(...parseInline(line.replace(/ {2,}$/, ''), options));
  });
  return out;
}

/**
 * A chat message as blocks.
 * @param {string} src
 * @param {{ origin?: string, imageOrigins?: string[] }} [options]
 */
export function parseMarkdown(src, options = {}, depth = 0) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const close = fence[1][0];
      const body = [];
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.startsWith(close.repeat(fence[1].length)) && !t.replace(/[`~]/g, '')) break;
        body.push(lines[i++]);
      }
      i++;
      out.push({ type: 'code', lang: fence[2], text: body.join('\n') });
      continue;
    }
    if (RULE.test(line)) {
      out.push({ type: 'hr' });
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      out.push({ type: 'heading', children: parseInline(h[1], options) });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length && lines[i].trim() && QUOTE.test(lines[i])) body.push(lines[i++].replace(QUOTE, ''));
      const text = body.join('\n');
      out.push({ type: 'quote', children: depth < MAX_DEPTH ? parseMarkdown(text, options, depth + 1) : [{ type: 'p', children: [text] }] });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null,
      );
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
      out.push({
        type: 'table',
        align,
        head: head.map((c) => parseInline(c, options)),
        rows: rows.map((r) => head.map((_, x) => parseInline(r[x] ?? '', options))),
      });
      continue;
    }
    const first = ITEM.exec(line);
    if (first) {
      const base = first[1].length;
      const ordered = /\d/.test(first[2]);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          // A blank line ends the list unless the list goes on after it.
          const n = lines[i + 1];
          const m = n !== undefined ? ITEM.exec(n) : null;
          if (m && m[1].length >= base) {
            i++;
            continue;
          }
          if (n !== undefined && /^\s+\S/.test(n) && n.search(/\S/) > base && items.length) {
            items[items.length - 1] += '\n';
            i++;
            continue;
          }
          break;
        }
        const m = ITEM.exec(l);
        if (m && m[1].length <= base + 1 && /\d/.test(m[2]) === ordered) items.push(m[3]);
        else if (m && m[1].length <= base + 1) break;
        else if (items.length && (m || /^\s/.test(l) || !startsBlock(l))) items[items.length - 1] += '\n' + l.slice(Math.min(base + 2, l.search(/\S/)));
        else break;
        i++;
      }
      out.push({
        type: 'list',
        ordered,
        start: ordered ? parseInt(first[2], 10) : 1,
        items: items.map((it) =>
          depth < MAX_DEPTH && it.includes('\n') ? parseMarkdown(it, options, depth + 1) : [{ type: 'p', children: withBreaks(it, options) }],
        ),
      });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && (!para.length || !startsBlock(lines[i], lines[i + 1]))) para.push(lines[i++]);
    out.push({ type: 'p', children: withBreaks(para.join('\n'), options) });
  }
  return out;
}

/** The message as plain text without Markdown marks (for previews and notifications). */
export function plainText(src) {
  const walk = (nodes) =>
    nodes
      .map((n) => {
        if (typeof n === 'string') return n;
        if (n.type === 'br') return ' ';
        if (n.type === 'code') return n.text;
        if (n.type === 'image' || n.type === 'imagelink') return n.alt;
        return walk(n.children ?? []);
      })
      .join('');
  const block = (b) => {
    switch (b.type) {
      case 'p':
      case 'heading':
        return walk(b.children);
      case 'code':
        return b.text;
      case 'quote':
        return b.children.map(block).join(' ');
      case 'list':
        return b.items.map((it) => it.map(block).join(' ')).join(' · ');
      case 'table':
        return [b.head, ...b.rows].map((r) => r.map(walk).join(' | ')).join(' · ');
      default:
        return '';
    }
  };
  return parseMarkdown(src, { origin: '' }).map(block).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
