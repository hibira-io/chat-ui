import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentSteps, ChatThread, Suggestions } from '../react.js';

const render = (el) => renderToStaticMarkup(el);

test('a thread with an automatic reply, suggestions and a reply box', () => {
  const out = render(
    h(ChatThread, {
      locale: 'zh-TW',
      origin: 'https://example.com',
      onSend: async () => {},
      messages: [
        { seq: 1, sender: 'customer', text: 'Pro 有 presence 嗎？' },
        { seq: 2, sender: 'agent', name: 'Hibira', text: '有，**Pro** 支援。', metadata: { assistant: true, suggestions: ['上限多少？', '怎麼搬家？'] } },
      ],
    }),
  );
  assert.match(out, /<strong>Pro<\/strong>/);
  assert.match(out, /自動回覆/);
  assert.match(out, /你可能還想問/);
  assert.match(out, /<button type="button" class="hb-chat-chip">上限多少？<\/button>/);
  assert.match(out, /placeholder="輸入訊息…"/);
});

test('no suggestions while the agent types, and none without a reply box', () => {
  const messages = [{ seq: 1, sender: 'agent', text: 'Hi', metadata: { assistant: true, suggestions: ['More?'] } }];
  assert.doesNotMatch(render(h(ChatThread, { messages, typing: true, onSend: async () => {} })), /hb-chat-chip/);
  assert.doesNotMatch(render(h(ChatThread, { messages })), /hb-chat-chip|textarea/);
});

test('handoff badge', () => {
  const out = render(h(ChatThread, { messages: [{ seq: 1, sender: 'agent', text: 'A person will reply.', metadata: { assistant: true, handoff: true } }] }));
  assert.match(out, /hb-chat-badge is-handoff/);
  assert.match(out, /Passed to our team/);
});

test('agent steps', () => {
  assert.equal(render(h(AgentSteps, { typing: false, step: 'writing' })), '');
  assert.match(render(h(AgentSteps, { typing: true, step: 'writing', locale: 'ja' })), /data-step="writing".*回答を作成しています/);
  assert.match(render(h(AgentSteps, { typing: true })), /Typing…/);
  assert.match(render(h(AgentSteps, { typing: true, step: 'unknown' })), /Typing…/);
});

test('suggestions escape their text', () => {
  assert.match(render(h(Suggestions, { items: ['<b>x</b>'], onPick() {} })), /&lt;b&gt;x&lt;\/b&gt;/);
  assert.equal(render(h(Suggestions, { items: [], onPick() {} })), '');
});

test('Chat API messages: system notes, withdrawn, edited, internal notes, files and reactions', () => {
  const out = render(
    h(ChatThread, {
      me: 'ann',
      messages: [
        { seq: 1, sender: '', kind: 'system', text: 'Bo joined the conversation' },
        { seq: 2, sender: 'bo', name: 'Bo', kind: 'text', text: 'Hello', edited_at: '2026-11-08T00:00:00Z', reactions: { '👍': ['ann', 'cy'] } },
        { seq: 3, sender: 'bo', kind: 'text', text: '', deleted_at: '2026-11-08T00:00:00Z' },
        { seq: 4, sender: 'cy', kind: 'text', text: 'Refund approved', visible_to: ['agent'] },
        {
          seq: 5,
          sender: 'bo',
          kind: 'text',
          text: '',
          attachments: [
            { id: 'f1', name: 'invoice.pdf', size: 2048, url: 'https://files.example.com/f1' },
            { id: 'f2', name: 'bad.txt', size: 1, url: 'javascript:alert(1)' },
          ],
        },
      ],
    }),
  );
  assert.match(out, /<li class="hb-chat-system" data-kind="system"><span>Bo joined the conversation<\/span><\/li>/);
  assert.match(out, />edited</);
  assert.match(out, /hb-chat-reactions/);
  assert.match(out, /<li class="is-mine" title="ann, cy">👍 <span>2<\/span><\/li>/);
  assert.match(out, /is-removed/);
  assert.match(out, /Message removed/);
  assert.match(out, /is-note/);
  assert.match(out, /Internal note/);
  assert.match(out, /href="https:\/\/files.example.com\/f1"/);
  assert.match(out, /invoice.pdf/);
  assert.doesNotMatch(out, /javascript:/);
  assert.match(out, /bad.txt/);
});

test('a system message is not the last reply for suggestions', () => {
  const messages = [
    { seq: 1, sender: 'agent', text: 'Hi', metadata: { assistant: true, suggestions: ['More?'] } },
    { seq: 2, sender: '', kind: 'system', text: 'Conversation moved to the sales queue' },
  ];
  assert.match(render(h(ChatThread, { messages, onSend: async () => {} })), /hb-chat-chip/);
});
