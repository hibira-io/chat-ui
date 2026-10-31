// Server side of the protocol (PROTOCOL.md), for Node: tell a conversation's
// channel that a message arrived, that someone is typing, or what your agent
// is doing, with the standard `pusher` library pointed at your Hibira app.
// Your backend stores the messages; the channel only carries hints.

export { STEPS } from './conversation.js';

const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_CHARS = 80;
const LINK_LIKE = /https?:\/\/|www\.|\w\.(com|io|net|org|dev|app)\b/i;

/**
 * Keeps up to three short, distinct follow-up questions without links,
 * line breaks or markup: the customer sends one as their message.
 * @param {unknown} list
 */
export function cleanSuggestions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const v = raw.trim();
    const n = [...v].length;
    const key = v.toLowerCase();
    if (n < 2 || n > MAX_SUGGESTION_CHARS || /[\n\r<>]/.test(v) || LINK_LIKE.test(v) || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * The metadata of an automatic reply: the components show it as automatic,
 * with its follow-up suggestions, or as handed to a person.
 * @param {{ handoff?: boolean, suggestions?: unknown }} [options]
 */
export function agentMetadata(options = {}) {
  const suggestions = options.handoff ? [] : cleanSuggestions(options.suggestions);
  return {
    assistant: true,
    ...(options.handoff ? { handoff: true } : {}),
    ...(suggestions.length ? { suggestions } : {}),
  };
}

/**
 * @param {{ pusher: { trigger: (channel: string, event: string, data: any) => Promise<any> },
 *   typingEvery?: number }} options
 */
export function createChatServer(options) {
  if (!options?.pusher?.trigger) throw new TypeError('createChatServer() needs a pusher instance.');
  const { pusher } = options;
  const every = options.typingEvery ?? 4_000;
  const trigger = (channel, event, data) =>
    Promise.resolve(pusher.trigger(channel, event, data)).catch(() => {
      // Hints are best effort: the page polls.
    });

  return {
    /** A message was stored: pages read what they have not seen. */
    message: (channel, { seq, from }) => trigger(channel, 'message', { seq, ...(from ? { from } : {}) }),
    /** Someone on `from`'s side is typing (pages send this every few seconds while a person types). */
    typing: (channel, { from = 'agent', step } = {}) => trigger(channel, 'typing', { from, ...(step ? { step } : {}) }),
    /** Any other hint the page handles itself (status, read, ...). */
    hint: (channel, event, data = {}) => trigger(channel, event, data),

    /**
     * Shows the agent at work until the returned stop() is called: a typing
     * hint now, again every few seconds, and at once on each step().
     * @returns {{ step: (name: string) => void, stop: () => void }}
     */
    agentTyping(channel, { from = 'agent', step = 'reading' } = {}) {
      let current = step;
      let stopped = false;
      const send = () => (stopped ? Promise.resolve() : trigger(channel, 'typing', { from, step: current }));
      void send();
      const timer = setInterval(send, every);
      timer.unref?.();
      return {
        step(name) {
          if (name === current || stopped) return;
          current = name;
          void send();
        },
        stop() {
          stopped = true;
          clearInterval(timer);
        },
      };
    },
  };
}
