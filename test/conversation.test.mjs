import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConversation, mergeMessages } from '../index.js';

const msg = (seq, sender = 'customer', metadata) => ({ id: 'm' + seq, seq, sender, text: 't' + seq, metadata });

/** A pusher-js stand-in: emit() delivers an event on a channel. */
function fakePusher() {
  const channels = new Map();
  return {
    connection: { state: 'connected', bind() {}, unbind() {} },
    subscribe(name) {
      const ch = { globals: new Set(), binds: new Map() };
      ch.bind_global = (fn) => ch.globals.add(fn);
      ch.unbind_global = (fn) => ch.globals.delete(fn);
      ch.bind = (e, fn) => ch.binds.set(e, fn);
      ch.unbind = (e) => ch.binds.delete(e);
      channels.set(name, ch);
      return ch;
    },
    emit(name, event, data) {
      channels.get(name)?.globals.forEach((fn) => fn(event, data));
    },
    channels,
  };
}

test('mergeMessages orders by seq without repeats', () => {
  assert.deepEqual(mergeMessages([msg(1), msg(3)], [msg(2), msg(3)]).map((m) => m.seq), [1, 2, 3]);
});

test('reads on start, on a message hint, and shows typing with the step', async () => {
  const server = [msg(1)];
  const asked = [];
  const pusher = fakePusher();
  const conv = createConversation({
    pusher,
    channel: 'private-chat.c1',
    load: async (after) => {
      asked.push(after);
      return { messages: server.filter((m) => m.seq > after), status: 'open' };
    },
  });
  conv.start();
  await conv.refresh();
  assert.deepEqual(conv.get().messages.map((m) => m.seq), [1]);
  assert.equal(conv.get().extra.status, 'open');

  pusher.emit('private-chat.c1', 'typing', { from: 'agent', step: 'writing' });
  assert.equal(conv.get().typing, true);
  assert.equal(conv.get().step, 'writing');
  // Its own typing echo is ignored.
  pusher.emit('private-chat.c1', 'typing', { from: 'customer' });
  assert.equal(conv.get().step, 'writing');

  server.push(msg(2, 'agent', { assistant: true, suggestions: ['More?'] }));
  pusher.emit('private-chat.c1', 'message', { seq: 2, from: 'agent' });
  assert.equal(conv.get().typing, false);
  await conv.refresh();
  assert.deepEqual(conv.get().messages.map((m) => m.seq), [1, 2]);
  assert.ok(asked.includes(1));
  // A hint for something it has: no read.
  const n = asked.length;
  pusher.emit('private-chat.c1', 'message', { seq: 2 });
  assert.equal(asked.length, n);
  conv.stop();
});

test('send adds the stored message', async () => {
  const conv = createConversation({ load: async () => ({ messages: [] }), send: async (text) => ({ message: { seq: 1, sender: 'customer', text } }) });
  conv.start();
  await conv.send('hello');
  assert.equal(conv.get().messages[0].text, 'hello');
  conv.stop();
});

test('a failed read is kept as the error', async () => {
  const conv = createConversation({ load: async () => { throw new Error('down'); } });
  conv.start();
  await conv.refresh();
  assert.equal(conv.get().error.message, 'down');
  conv.stop();
});
