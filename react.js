// React components: a chat thread with Markdown messages, the agent's steps
// while it writes, replies that appear as typed, follow-up suggestions, copy
// buttons and a reply box. Import '@hibira-io/chat-ui/styles.css' for the
// default look.

import { createElement as h, Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { parseMarkdown } from './markdown.js';
import { isAutomatic, STEPS } from './conversation.js';
import { format, labelsFor } from './locales.js';

export { createConversation } from './conversation.js';

const LINK = { target: '_blank', rel: 'noopener noreferrer nofollow ugc' };

// Icons (Lucide shapes, inlined so the package needs no icon library).
const PATHS = {
  copy: ['M8 8h12v12H8z', 'M4 16V4h12'],
  check: ['M20 6 9 17l-5-5'],
  spinner: ['M21 12a9 9 0 1 1-6.22-8.56'],
  sparkles: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 3v4', 'M21 5h-4'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  image: ['M3 3h18v18H3z', 'M21 15l-5-5L5 21', 'M9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
};

function Icon({ name, size = 14, className }) {
  return h(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', className },
    PATHS[name].map((d, i) => h('path', { key: i, d })),
  );
}

// ------------------------------------------------------------ Markdown

function inline(nodes, key = 'i') {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    if (typeof n === 'string') return h(Fragment, { key: k }, n);
    switch (n.type) {
      case 'br':
        return h('br', { key: k });
      case 'code':
        return h('code', { key: k }, n.text);
      case 'strong':
      case 'em':
      case 'del':
        return h(n.type, { key: k }, inline(n.children, k));
      case 'link':
        return h('a', { key: k, href: n.href, ...LINK }, inline(n.children, k));
      case 'image':
        return h('a', { key: k, href: n.src, ...LINK, className: 'hb-chat-img' }, h('img', { src: n.src, alt: n.alt, loading: 'lazy', decoding: 'async' }));
      case 'imagelink':
        return h('a', { key: k, href: n.href, ...LINK, className: 'hb-chat-imglink' }, h(Icon, { name: 'image' }), n.alt);
      default:
        return h(Fragment, { key: k }, inline(n.children ?? [], k));
    }
  });
}

function blocks(list, labels, key = 'b') {
  return list.map((b, i) => {
    const k = `${key}.${i}`;
    switch (b.type) {
      case 'p':
        return h('p', { key: k }, inline(b.children, k));
      case 'heading':
        return h('p', { key: k, className: 'hb-chat-h' }, h('strong', null, inline(b.children, k)));
      case 'code':
        return h(
          'div',
          { key: k, className: 'hb-chat-pre' },
          h('pre', { 'data-lang': b.lang || undefined }, h('code', null, b.text)),
          h(CopyButton, { text: b.text, label: labels.copyCode, labels, className: 'hb-chat-code-copy' }),
        );
      case 'quote':
        return h('blockquote', { key: k }, blocks(b.children, labels, k));
      case 'list': {
        const items = b.items.map((item, j) => {
          const [first, ...rest] = item;
          return h('li', { key: j }, first?.type === 'p' ? [h(Fragment, { key: 'f' }, inline(first.children, `${k}.${j}`)), ...blocks(rest, labels, `${k}.${j}`)] : blocks(item, labels, `${k}.${j}`));
        });
        return b.ordered ? h('ol', { key: k, start: b.start !== 1 ? b.start : undefined }, items) : h('ul', { key: k }, items);
      }
      case 'table':
        return h(
          'div',
          { key: k, className: 'hb-chat-table' },
          h(
            'table',
            null,
            h('thead', null, h('tr', null, b.head.map((c, j) => h('th', { key: j, style: b.align[j] ? { textAlign: b.align[j] } : undefined }, inline(c, `${k}.h${j}`))))),
            h(
              'tbody',
              null,
              b.rows.map((r, j) => h('tr', { key: j }, r.map((c, x) => h('td', { key: x, style: b.align[x] ? { textAlign: b.align[x] } : undefined }, inline(c, `${k}.${j}.${x}`))))),
            ),
          ),
        );
      case 'hr':
        return h('hr', { key: k });
      default:
        return null;
    }
  });
}

/**
 * A message's Markdown, rendered safely (no HTML from the text).
 * @param {{ text: string, locale?: string, labels?: object, origin?: string, imageOrigins?: string[] }} props
 */
export function Markdown({ text, locale, labels, origin, imageOrigins }) {
  const l = labelsFor(locale, labels);
  return h('div', { className: 'hb-chat-md' }, blocks(parseMarkdown(text, { origin, imageOrigins }), l));
}

// ------------------------------------------------------------ pieces

/** Copies text, showing a check for a moment. */
export function CopyButton({ text, label, labels, locale, className }) {
  const l = labels ?? labelsFor(locale);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(id);
  }, [done]);
  const tip = done ? l.copied : label ?? l.copy;
  return h(
    'button',
    {
      type: 'button',
      className: 'hb-chat-icon-btn' + (className ? ' ' + className : ''),
      'aria-label': tip,
      title: tip,
      onClick: () => {
        globalThis.navigator?.clipboard?.writeText(text).then(
          () => setDone(true),
          () => undefined,
        );
      },
    },
    h(Icon, { name: done ? 'check' : 'copy' }),
  );
}

/**
 * The agent's progress while it writes: steps done so far with a check, the
 * current one with a spinner. Without a step, a plain typing line.
 */
export function AgentSteps({ typing, step, locale, labels }) {
  const l = labels ?? labelsFor(locale);
  const [seen, setSeen] = useState([]);
  const known = !!step && !!l.steps[step];
  useEffect(() => {
    if (!typing) setSeen([]);
    else if (known) setSeen((s) => (s.includes(step) ? s : [...s, step]));
  }, [typing, step, known]);
  if (!typing) return null;
  const order = (s) => (STEPS.includes(s) ? STEPS.indexOf(s) : STEPS.length);
  const list = [...new Set(known ? [...seen, step] : seen)].sort((a, b) => order(a) - order(b));
  if (!list.length) return h('p', { className: 'hb-chat-typing', 'aria-live': 'polite' }, l.typing);
  return h(
    'div',
    { className: 'hb-chat-steps', 'aria-live': 'polite' },
    h('span', { className: 'hb-chat-avatar' }, h(Icon, { name: 'sparkles' })),
    h(
      'ol',
      null,
      list.map((s) =>
        h('li', { key: s, className: s === step ? 'is-current' : 'is-done', 'data-step': s }, h(Icon, { name: s === step ? 'spinner' : 'check', className: s === step ? 'hb-chat-spin' : undefined }), h('span', null, l.steps[s])),
      ),
    ),
  );
}

/** Follow-up questions to send with one tap. */
export function Suggestions({ items, onPick, disabled, locale, labels }) {
  const l = labels ?? labelsFor(locale);
  if (!items?.length) return null;
  return h(
    'div',
    { className: 'hb-chat-suggestions' },
    h('span', null, l.suggestions),
    h(
      'div',
      null,
      items.map((s) => h('button', { key: s, type: 'button', className: 'hb-chat-chip', disabled, onClick: () => onPick(s) }, s)),
    ),
  );
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Shows text as if typed while `animate` is set: about 1.2 s at most,
 * whatever the length, by whole characters. Reduced motion shows it at once.
 */
export function useReveal(text, animate) {
  const chars = useRef([]);
  const [n, setN] = useState(() => (animate && !reducedMotion() ? 0 : Infinity));
  useEffect(() => {
    if (!animate || reducedMotion()) {
      setN(Infinity);
      return undefined;
    }
    chars.current = Array.from(text);
    const total = chars.current.length;
    const per = Math.max(1, Math.ceil(total / 60));
    let i = 0;
    const id = setInterval(() => {
      i += per;
      setN(i);
      if (i >= total) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [text, animate]);
  if (n === Infinity || n >= Array.from(text).length) return { shown: text, done: true };
  return { shown: chars.current.slice(0, n).join(''), done: false };
}

function ago(iso, locale) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.round((t - Date.now()) / 1000);
  const fmt = new Intl.RelativeTimeFormat(locale || 'en', { numeric: 'auto' });
  const abs = Math.abs(s);
  if (abs < 45) return fmt.format(0, 'second');
  if (abs < 3600) return fmt.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return fmt.format(Math.round(s / 3600), 'hour');
  return fmt.format(Math.round(s / 86400), 'day');
}

function Bubble({ m, mine, animate, seen, labels, locale, origin, imageOrigins, renderName }) {
  const auto = isAutomatic(m);
  const { shown, done } = useReveal(m.text, animate && auto);
  return h(
    'li',
    { className: 'hb-chat-msg ' + (mine ? 'is-mine' : 'is-theirs') + (auto ? ' is-agent' : ''), 'data-sender': m.sender },
    h('div', { className: 'hb-chat-bubble' + (done ? '' : ' is-revealing') }, h('div', { className: 'hb-chat-md' }, blocks(parseMarkdown(shown, { origin, imageOrigins }), labels))),
    h(
      'div',
      { className: 'hb-chat-meta' },
      !mine && h('span', null, renderName ? renderName(m) : m.name),
      auto &&
        (m.metadata?.handoff
          ? h('span', { className: 'hb-chat-badge is-handoff' }, h(Icon, { name: 'user', size: 12 }), labels.handoff)
          : h('span', { className: 'hb-chat-badge' }, h(Icon, { name: 'sparkles', size: 12 }), labels.automatic)),
      m.created_at && h('time', { dateTime: m.created_at, title: new Date(m.created_at).toLocaleString(locale) }, ago(m.created_at, locale)),
      seen && h('span', null, labels.seen),
      auto && done && !m.metadata?.handoff && h(CopyButton, { text: m.text, labels }),
    ),
  );
}

/**
 * A conversation: messages, the agent's steps, follow-up suggestions and a
 * reply box. Give it the state from useConversation(), or your own.
 */
export function ChatThread({
  messages,
  typing = false,
  step,
  onSend,
  me = 'customer',
  locale,
  labels: overrides,
  maxLength = 4000,
  readSeq,
  disabled = false,
  footer,
  origin,
  imageOrigins,
  renderName,
}) {
  const labels = labelsFor(locale, overrides);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  const last = messages.length ? messages[messages.length - 1].seq : 0;
  // Only messages that arrive while the thread is open are revealed as typed.
  const firstSeq = useRef(null);
  if (firstSeq.current === null && messages.length) firstSeq.current = last;
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [last, typing]);
  const lastMine = [...messages].reverse().find((m) => m.sender === me);
  const lastMsg = messages[messages.length - 1];
  const suggestions = lastMsg && isAutomatic(lastMsg) && !typing ? lastMsg.metadata?.suggestions ?? [] : [];
  const tooLong = [...text.trim()].length > maxLength;
  const canSend = !!onSend && !disabled;

  async function send(e, picked) {
    e?.preventDefault?.();
    const v = (picked ?? text).trim();
    if (!v || [...v].length > maxLength || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSend(v);
      if (picked === undefined) setText('');
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return h(
    'div',
    { className: 'hb-chat' },
    h(
      'ol',
      { className: 'hb-chat-thread', 'aria-live': 'polite' },
      !messages.length && h('li', { className: 'hb-chat-empty' }, labels.empty),
      messages.map((m) =>
        h(Bubble, {
          key: m.seq,
          m,
          mine: m.sender === me,
          animate: firstSeq.current !== null && m.seq > firstSeq.current,
          seen: m === lastMine && readSeq !== undefined && readSeq >= m.seq,
          labels,
          locale,
          origin,
          imageOrigins,
          renderName,
        }),
      ),
      h('li', { ref: end, 'aria-hidden': 'true' }),
    ),
    h(AgentSteps, { typing, step, labels }),
    canSend && h(Suggestions, { items: suggestions, labels, disabled: busy, onPick: (v) => void send(undefined, v) }),
    canSend &&
      h(
        'form',
        { className: 'hb-chat-compose', onSubmit: send, noValidate: true },
        h('textarea', {
          rows: 2,
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyDown: (e) => {
            // Enter sends; Shift+Enter starts a new line (not while composing CJK text).
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
              e.preventDefault();
              void send();
            }
          },
          'aria-label': labels.placeholder,
          placeholder: labels.placeholder,
          'aria-invalid': tooLong || undefined,
        }),
        h('button', { type: 'submit', className: 'hb-chat-send', 'aria-label': labels.send, title: labels.send, disabled: busy || !text.trim() || tooLong }, h(Icon, { name: 'send', size: 16 })),
      ),
    (error || tooLong) && h('p', { className: 'hb-chat-error', role: 'alert' }, tooLong ? format(labels.tooLong, { n: maxLength }) : error),
    footer,
  );
}

/** The state of a conversation from createConversation(), started while mounted. */
export function useConversation(conversation) {
  useEffect(() => conversation?.start(), [conversation]);
  return useSyncExternalStore(
    conversation?.subscribe ?? noop,
    conversation?.get ?? emptyState,
    conversation?.get ?? emptyState,
  );
}

const EMPTY = { messages: [], loading: false, error: null, typing: false, step: undefined, extra: {} };
const emptyState = () => EMPTY;
const noop = () => () => {};

/** ChatThread wired to a conversation from createConversation(). */
export function Chat({ conversation, ...props }) {
  const state = useConversation(conversation);
  return h(ChatThread, { messages: state.messages, typing: state.typing, step: state.step, onSend: conversation ? (t) => conversation.send(t) : undefined, ...props });
}
