import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatClient, chatConversation, tokenUser, ChatApiError } from '../hibira.js';

const tok = (claims) => 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';

/** A fetch stand-in: answers from routes and records each call. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, ...init, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    const key = `${init.method ?? 'GET'} ${String(url).replace(/^https?:\/\/[^/]+/, '')}`;
    const r = routes[key] ?? routes[key.split('?')[0]];
    const [status, body] = typeof r === 'function' ? r(calls.at(-1)) : r ?? [404, { error: 'nope ' + key }];
    return { ok: status < 300, status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

test('tokenUser reads sub, including non-ASCII', () => {
  assert.equal(tokenUser(tok({ sub: '安' })), '安');
  assert.equal(tokenUser('garbage'), '');
});

test('client calls the user routes with the token', async () => {
  const f = fakeFetch({
    'GET /apps/a1/chat/me/conversations/trip/messages': [200, { messages: [{ seq: 1, sender: 'ann', text: 'hi' }], last_seq: 1 }],
    'POST /apps/a1/chat/me/conversations/trip/messages': [201, { message: { seq: 2, sender: 'ann', text: 'yo' } }],
    'DELETE /apps/a1/chat/me/conversations/trip/messages/2/reactions': [200, { message: { seq: 2 } }],
    'GET /apps/a1/chat/me/conversations/trip/search': [200, { messages: [], next: '' }],
  });
  const c = createChatClient({ appId: 'a1', token: tok({ sub: 'ann' }), fetch: f });
  assert.equal(c.user(), 'ann');
  assert.equal((await c.messages('trip', { last: 10 })).messages.length, 1);
  assert.match(f.calls[0].url, /^https:\/\/api\.hibira\.io\/apps\/a1\/chat\/me\/conversations\/trip\/messages\?last=10$/);
  assert.equal(f.calls[0].headers.Authorization, 'Bearer ' + tok({ sub: 'ann' }));
  await c.send('trip', 'yo');
  assert.deepEqual(f.calls[1].body, { text: 'yo' });
  await c.react('trip', 2, '👍', false);
  assert.match(f.calls[2].url, /reactions\?emoji=%F0%9F%91%8D$/);
  await c.search('trip', '車站');
  assert.match(f.calls[3].url, /search\?q=%E8%BB%8A%E7%AB%99$/);
  await assert.rejects(c.conversation('none'), (e) => e instanceof ChatApiError && e.status === 404);
});

test('a token function is called again after a 401', async () => {
  let n = 0;
  const f = fakeFetch({ 'GET /apps/a1/chat/me/conversations': (call) => (call.headers.Authorization.endsWith('2') ? [200, { conversations: [], next: '' }] : [401, { error: 'expired' }]) });
  const c = createChatClient({ appId: 'a1', host: 'http://localhost:8080', token: () => 'tok' + ++n, fetch: f });
  assert.deepEqual(await c.conversations(), { conversations: [], next: '' });
  assert.equal(n, 2);
  assert.match(f.calls[0].url, /^http:\/\/localhost:8080\//);
});

test('upload puts the file to the presigned URL', async () => {
  const f = fakeFetch({
    'POST /apps/a1/chat/me/conversations/trip/attachments': [201, { attachment: { id: 'att_1', name: 'a.png' }, upload: { url: 'https://bucket.example/put', method: 'PUT', headers: { 'Content-Type': 'image/png' } } }],
    'PUT /put': [200, {}],
  });
  const c = createChatClient({ appId: 'a1', token: 't', fetch: f });
  const blob = new Blob(['x'], { type: 'image/png' });
  const at = await c.upload('trip', blob, { name: 'a.png' });
  assert.equal(at.id, 'att_1');
  assert.deepEqual(f.calls[0].body, { name: 'a.png', content_type: 'image/png', size: 1 });
  assert.equal(f.calls[1].body, blob);
});

/** pusher-js stand-in with a signed-in user. */
function fakePusher() {
  const binds = new Map();
  return {
    connection: { state: 'connected', bind() {}, unbind() {} },
    user: {
      bind: (e, fn) => binds.set(e, fn),
      unbind: (e) => binds.delete(e),
    },
    emit: (e, d) => binds.get(e)?.(d),
    binds,
  };
}

test('chatConversation loads, follows events for its conversation, and sends', async () => {
  const f = fakeFetch({
    'GET /apps/a1/chat/me/conversations/trip/messages': [200, { messages: [{ seq: 1, sender: 'bob', text: 'hi' }], last_seq: 1 }],
    'POST /apps/a1/chat/me/conversations/trip/messages': [201, { message: { seq: 3, sender: 'ann', text: 'me' } }],
  });
  const c = createChatClient({ appId: 'a1', token: tok({ sub: 'ann' }), fetch: f });
  const pusher = fakePusher();
  const conv = chatConversation(c, 'trip', { pusher });
  conv.start();
  await conv.refresh();
  assert.deepEqual(conv.get().messages.map((m) => m.seq), [1]);
  assert.match(f.calls[0].url, /last=50/);

  pusher.emit('chat.typing', { conversation_id: 'trip', user_id: 'bob', typing: true });
  assert.equal(conv.get().typing, true);
  pusher.emit('chat.message', { conversation_id: 'trip', message: { seq: 2, sender: 'bob', text: 'there' } });
  assert.equal(conv.get().typing, false);
  pusher.emit('chat.message', { conversation_id: 'other', message: { seq: 9, sender: 'bob', text: 'x' } });
  pusher.emit('chat.message_updated', { conversation_id: 'trip', message: { seq: 1, sender: 'bob', text: 'hi (edited)' } });
  assert.deepEqual(conv.get().messages.map((m) => m.text), ['hi (edited)', 'there']);

  await conv.send('me');
  assert.deepEqual(conv.get().messages.map((m) => m.seq), [1, 2, 3]);
  conv.stop();
  assert.equal(pusher.binds.size, 0);
});
