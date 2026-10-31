// A conversation kept up to date in the browser, without a UI framework.
//
// Messages are read from your backend (`load`), never from the socket:
// events on the conversation's channel are hints (PROTOCOL.md). A `message`
// hint makes it read what it has not seen; a `typing` hint shows that the
// other side (a person or your agent) is writing, with the agent's `step`.
// A missed event costs a poll, never a message: it polls slowly while the
// socket is up and every few seconds without one.

/** What an agent can be doing while it writes a reply, in order (PROTOCOL.md). */
export const STEPS = Object.freeze(['reading', 'account', 'searching', 'writing', 'checking']);

/** Polling intervals, with the socket connected (a safety net) and without. */
export const POLL_LIVE_MS = 60_000;
export const POLL_MS = 10_000;
/** How long a typing hint shows without another one. */
export const TYPING_SHOW_MS = 8_000;

/** Merges a page of messages into a list ordered by seq, without repeats. */
export function mergeMessages(list, page) {
  if (!page?.length) return list;
  const bySeq = new Map(list.map((m) => [m.seq, m]));
  for (const m of page) bySeq.set(m.seq, m);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export const lastSeq = (list) => (list.length ? list[list.length - 1].seq : 0);

/** An automatic reply (your agent marks it in metadata). */
export const isAutomatic = (m) => !!m?.metadata?.assistant;

/**
 * @param {{
 *   load: (after: number, signal: AbortSignal) => Promise<{ messages: any[] } & Record<string, any>>,
 *   send?: (text: string) => Promise<any>,
 *   pusher?: any,
 *   channel?: string,
 *   me?: string,
 *   pollMs?: number,
 *   livePollMs?: number,
 *   onEvent?: (event: string, data: any) => void,
 * }} options
 */
export function createConversation(options) {
  if (typeof options?.load !== 'function') throw new TypeError('createConversation() needs a load(after, signal) function.');
  const me = options.me ?? 'customer';
  const pollMs = options.pollMs ?? POLL_MS;
  const livePollMs = options.livePollMs ?? POLL_LIVE_MS;
  let state = { messages: [], loading: true, error: null, typing: false, step: undefined, extra: {} };
  const listeners = new Set();
  let timer = null;
  let typingTimer = null;
  let abort = null;
  let inflight = null;
  let again = false;
  let stopped = true;
  let unbind = [];

  const set = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn(state));
  };

  const connected = () => options.pusher?.connection?.state === 'connected';

  function schedule() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void refresh(), connected() ? livePollMs : pollMs);
  }

  function setTyping(on, step) {
    clearTimeout(typingTimer);
    typingTimer = on ? setTimeout(() => setTyping(false), TYPING_SHOW_MS) : null;
    const next = on ? step : undefined;
    if (state.typing !== on || state.step !== next) set({ typing: on, step: next });
  }

  function onHint(event, data) {
    const d = data && typeof data === 'object' ? data : {};
    if (event === 'typing') {
      if (d.from !== me) setTyping(true, typeof d.step === 'string' ? d.step : undefined);
      return;
    }
    if (event === 'message') {
      if (d.from !== me) setTyping(false);
      if (typeof d.seq === 'number' && d.seq <= lastSeq(state.messages)) return;
      void refresh();
      return;
    }
    options.onEvent?.(event, d);
  }

  /** Reads what is new; calls made while one runs fold into one more. */
  function refresh() {
    if (stopped) return Promise.resolve();
    if (inflight) {
      again = true;
      return inflight;
    }
    const run = async () => {
      do {
        again = false;
        abort = new AbortController();
        try {
          const { messages = [], ...extra } = await options.load(lastSeq(state.messages), abort.signal);
          if (stopped) return;
          set({ messages: mergeMessages(state.messages, messages), extra: { ...state.extra, ...extra }, error: null, loading: false });
        } catch (err) {
          if (stopped || err?.name === 'AbortError') return;
          set({ error: err, loading: false });
        }
      } while (again && !stopped);
    };
    inflight = run().finally(() => {
      inflight = null;
      schedule();
    });
    return inflight;
  }

  function start() {
    if (!stopped) return stop;
    stopped = false;
    const { pusher, channel } = options;
    if (pusher && channel) {
      const ch = pusher.subscribe(channel);
      const global = (event, data) => {
        if (event.startsWith('pusher:') || event.startsWith('pusher_internal:')) return;
        onHint(event, data);
      };
      const subscribed = () => void refresh();
      ch.bind_global(global);
      ch.bind('pusher:subscription_succeeded', subscribed);
      const state = () => schedule();
      pusher.connection?.bind?.('state_change', state);
      unbind.push(() => {
        ch.unbind_global(global);
        ch.unbind('pusher:subscription_succeeded', subscribed);
        pusher.connection?.unbind?.('state_change', state);
      });
    }
    if (typeof document !== 'undefined') {
      const vis = () => document.visibilityState === 'visible' && void refresh();
      document.addEventListener('visibilitychange', vis);
      unbind.push(() => document.removeEventListener('visibilitychange', vis));
    }
    void refresh();
    return stop;
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(typingTimer);
    abort?.abort();
    unbind.forEach((fn) => fn());
    unbind = [];
  }

  /** Adds a message the page just sent (the server's copy). */
  function added(message) {
    if (message && typeof message.seq === 'number') set({ messages: mergeMessages(state.messages, [message]) });
  }

  /** Sends through options.send and adds the message it returns. */
  async function send(text) {
    if (!options.send) throw new Error('createConversation() has no send(text) function.');
    const out = await options.send(text);
    added(out?.message ?? out);
    return out;
  }

  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start,
    stop,
    refresh,
    added,
    send,
    /** For tests and custom transports: deliver a hint as if from the channel. */
    hint: onHint,
  };
}
