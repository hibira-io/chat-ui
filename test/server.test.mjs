import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentMetadata, cleanSuggestions, createChatServer } from '../server.js';

test('cleanSuggestions keeps three short questions without links', () => {
  assert.deepEqual(cleanSuggestions([' a ', 'ok?', 'www.evil.example', 'visit evil.com now', '<b>x</b>', 'x'.repeat(81), 'OK?', 'fine', 'third', 'fourth']), ['ok?', 'fine', 'third']);
  assert.deepEqual(cleanSuggestions('nope'), []);
});

test('agentMetadata', () => {
  assert.deepEqual(agentMetadata(), { assistant: true });
  assert.deepEqual(agentMetadata({ suggestions: ['Is there a free plan?'] }), { assistant: true, suggestions: ['Is there a free plan?'] });
  assert.deepEqual(agentMetadata({ handoff: true, suggestions: ['x?'] }), { assistant: true, handoff: true });
});

test('hints and agent steps', async () => {
  const sent = [];
  const chat = createChatServer({ pusher: { trigger: async (c, e, d) => sent.push([c, e, d]) }, typingEvery: 60_000 });
  await chat.message('private-chat.c1', { seq: 4, from: 'agent' });
  const t = chat.agentTyping('private-chat.c1');
  t.step('writing');
  t.step('writing');
  t.step('checking');
  t.stop();
  t.step('reading');
  assert.deepEqual(sent, [
    ['private-chat.c1', 'message', { seq: 4, from: 'agent' }],
    ['private-chat.c1', 'typing', { from: 'agent', step: 'reading' }],
    ['private-chat.c1', 'typing', { from: 'agent', step: 'writing' }],
    ['private-chat.c1', 'typing', { from: 'agent', step: 'checking' }],
  ]);
});

test('a failing trigger does not throw', async () => {
  const chat = createChatServer({ pusher: { trigger: async () => { throw new Error('down'); } } });
  await chat.typing('c', { step: 'reading' });
});
