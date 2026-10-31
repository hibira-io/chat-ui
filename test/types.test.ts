import { createConversation, labelsFor, parseMarkdown, type ChatMessage } from '@hibira-io/chat-ui';
import { Chat, ChatThread } from '@hibira-io/chat-ui/react';
import { agentMetadata, createChatServer } from '@hibira-io/chat-ui/server';
import { createElement } from 'react';

const conv = createConversation({
  load: async (after) => ({ messages: [] as ChatMessage[], after }),
  send: async (text) => ({ message: { seq: 1, sender: 'customer', text } }),
  channel: 'private-chat.c1',
});
const state = conv.get();
const step: string | undefined = state.step;
const blocks = parseMarkdown('**hi**', { origin: 'https://example.com' });
const label: string = labelsFor('ja').steps.writing;
createElement(ChatThread, { messages: state.messages, typing: state.typing, step, locale: 'zh-TW', onSend: async () => undefined });
createElement(Chat, { conversation: conv, locale: 'en' });
const server = createChatServer({ pusher: { trigger: async () => undefined } });
const t = server.agentTyping('private-chat.c1', { step: 'reading' });
t.step('writing');
t.stop();
const meta = agentMetadata({ suggestions: ['Is there a free plan?'] });
export { blocks, label, meta };
