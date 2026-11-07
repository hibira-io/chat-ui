// A client for the Hibira Chat API's user routes (/apps/{appId}/chat/me),
// and an adapter that turns one of its conversations into a
// createConversation() for the components. The user token comes from your
// server (an HS256 JWT signed with the app secret, { sub, exp }); messages
// are stored by Hibira, so you write no load/send routes.

import { createConversation } from './conversation.js';

export const DEFAULT_HOST = 'api.hibira.io';

/** A user token's claims, read without checking them ({} when unreadable). */
function claims(token) {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) ?? {};
  } catch {
    return {};
  }
}

/** The user ID (sub) inside a user token, or '' when it cannot be read. */
export const tokenUser = (token) => String(claims(token).sub ?? '');

/** An error answered by the Chat API, with its HTTP status. */
export class ChatApiError extends Error {
  constructor(status, message) {
    super(message || `Chat API request failed (${status})`);
    this.name = 'ChatApiError';
    this.status = status;
  }
}

/**
 * The Chat API as the signed-in user.
 *
 * options:
 *   appId     the Hibira app ID (required)
 *   token     the user token: a string, or a function returning one (or a
 *             promise of one), called again before it expires and after a 401
 *   tokenUrl  instead of token: a URL on your site that answers {token}
 *   host      the HTTP API host (default api.hibira.io); may include http://
 *   fetch     a fetch implementation (default globalThis.fetch)
 */
export function createChatClient(options = {}) {
  if (!options.appId) throw new TypeError('createChatClient: appId is required');
  if (!options.token && !options.tokenUrl) throw new TypeError('createChatClient: token or tokenUrl is required');
  const doFetch = options.fetch ?? ((...a) => globalThis.fetch(...a));
  const host = (options.host ?? DEFAULT_HOST).replace(/\/+$/, '');
  const base = `${/^https?:\/\//.test(host) ? host : `https://${host}`}/apps/${encodeURIComponent(options.appId)}/chat/me`;
  let token = typeof options.token === 'string' ? options.token : null;
  let pending = null;

  async function fetchToken() {
    if (typeof options.token === 'string') return options.token;
    if (typeof options.token === 'function') return options.token();
    const res = await doFetch(options.tokenUrl, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new ChatApiError(res.status, `token endpoint answered ${res.status}`);
    return (await res.json()).token;
  }

  function currentToken(force) {
    const exp = token ? claims(token).exp ?? 0 : 0;
    if (!force && token && (exp === 0 || exp - Date.now() / 1000 > 30)) return Promise.resolve(token);
    pending ??= Promise.resolve(fetchToken())
      .then((t) => (token = t))
      .finally(() => (pending = null));
    return pending;
  }

  async function call(method, path, { body, query, signal } = {}) {
    const params = Object.entries(query ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
    const qs = new URLSearchParams(params.map(([k, v]) => [k, String(v)])).toString();
    const url = base + path + (qs ? `?${qs}` : '');
    for (let attempt = 0; ; attempt++) {
      const t = await currentToken(attempt > 0);
      const res = await doFetch(url, {
        method,
        signal,
        headers: { Authorization: `Bearer ${t}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 && attempt === 0 && typeof options.token !== 'string') continue;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ChatApiError(res.status, data?.error);
      return data;
    }
  }

  const conv = (id) => `/conversations/${encodeURIComponent(id)}`;

  return {
    /** The token's user, once a token is known. */
    user: () => (token ? tokenUser(token) : ''),
    conversations: ({ limit, before, signal } = {}) => call('GET', '/conversations', { query: { limit, before }, signal }),
    conversation: (id, { signal } = {}) => call('GET', conv(id), { signal }).then((d) => d.conversation),
    messages: (id, { after, last, limit, signal } = {}) => call('GET', `${conv(id)}/messages`, { query: { after, last, limit }, signal }),
    search: (id, q, { before, limit, signal } = {}) => call('GET', `${conv(id)}/search`, { query: { q, before, limit }, signal }),
    send: (id, message) => call('POST', `${conv(id)}/messages`, { body: typeof message === 'string' ? { text: message } : message }),
    edit: (id, seq, change) => call('PUT', `${conv(id)}/messages/${seq}`, { body: typeof change === 'string' ? { text: change } : change }).then((d) => d.message),
    remove: (id, seq) => call('DELETE', `${conv(id)}/messages/${seq}`).then((d) => d.message),
    react: (id, seq, emoji, on = true) =>
      (on
        ? call('POST', `${conv(id)}/messages/${seq}/reactions`, { body: { emoji } })
        : call('DELETE', `${conv(id)}/messages/${seq}/reactions`, { query: { emoji } })
      ).then((d) => d.message),
    report: (id, seq, reason) => call('POST', `${conv(id)}/messages/${seq}/reports`, { body: { reason } }).then((d) => d.report),
    read: (id, seq) => call('POST', `${conv(id)}/read`, { body: { seq } }),
    typing: (id, typing = true) => call('POST', `${conv(id)}/typing`, { body: { typing } }),
    /** Uploads a File or Blob; send its result in a message's attachments. */
    async upload(id, file, { name } = {}) {
      const fileName = name ?? file?.name ?? 'file';
      const { attachment, upload } = await call('POST', `${conv(id)}/attachments`, {
        body: { name: fileName, content_type: file.type || 'application/octet-stream', size: file.size },
      });
      const res = await doFetch(upload.url, { method: upload.method ?? 'PUT', headers: upload.headers ?? {}, body: file });
      if (!res.ok) throw new ChatApiError(res.status, 'Upload failed');
      return attachment;
    },
  };
}

/** Chat API events, sent to each member's user channel (pusher.signin). */
export const CHAT_EVENTS = Object.freeze(['chat.message', 'chat.message_updated', 'chat.typing', 'chat.read', 'chat.conversation', 'chat.left', 'chat.deleted']);

/**
 * Binds Chat API events on a signed-in pusher-js client; returns unbind.
 * @param {any} pusher
 * @param {(event: string, data: any) => void} handler
 */
export function onChatEvents(pusher, handler) {
  const user = pusher?.user;
  if (!user?.bind) return () => {};
  const fns = CHAT_EVENTS.map((e) => {
    const fn = (data) => handler(e, data);
    user.bind(e, fn);
    return [e, fn];
  });
  return () => fns.forEach(([e, fn]) => user.unbind?.(e, fn));
}

/**
 * One Chat API conversation as a createConversation(), for <Chat> and
 * useConversation(). Live events come from pusher (signed in with
 * pusher.signin()); without it, it polls.
 * @param {ReturnType<typeof createChatClient>} client
 * @param {string} id
 * @param {{ pusher?: any, me?: string, pollMs?: number, livePollMs?: number, onEvent?: (event: string, data: any) => void }} [options]
 */
export function chatConversation(client, id, options = {}) {
  const conversation = createConversation({
    me: options.me ?? client.user(),
    pusher: options.pusher,
    pollMs: options.pollMs,
    livePollMs: options.livePollMs,
    onEvent: options.onEvent,
    load: (after, signal) => client.messages(id, after ? { after, signal } : { last: 50, signal }),
    send: (text) => client.send(id, { text }),
  });
  const start = conversation.start;
  let unbind = () => {};
  conversation.start = () => {
    start();
    unbind();
    unbind = onChatEvents(options.pusher, (event, data) => {
      if (data?.conversation_id !== id) return;
      const me = options.me ?? client.user();
      if (event === 'chat.message' || event === 'chat.message_updated') {
        conversation.added(data.message);
        if (event === 'chat.message') conversation.hint('message', { from: data.message?.sender, seq: data.message?.seq });
      } else if (event === 'chat.typing') {
        if (data.user_id !== me && data.typing !== false) conversation.hint('typing', { from: data.user_id });
      } else {
        options.onEvent?.(event, data);
      }
    });
    return () => conversation.stop();
  };
  const stop = conversation.stop;
  conversation.stop = () => {
    unbind();
    unbind = () => {};
    stop();
  };
  return conversation;
}
