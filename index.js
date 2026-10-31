// Framework-free core: Markdown as data, the conversation store, labels.
// React components: '@hibira-io/chat-ui/react'. Server helpers:
// '@hibira-io/chat-ui/server'.

export { parseMarkdown, parseInline, plainText, safeHref, imageSrc } from './markdown.js';
export { createConversation, mergeMessages, lastSeq, isAutomatic, STEPS, POLL_MS, POLL_LIVE_MS, TYPING_SHOW_MS } from './conversation.js';
export { labelsFor, LOCALES, format } from './locales.js';
