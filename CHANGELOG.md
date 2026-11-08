# Changelog

## 0.3.0

- The thread shows more of what the Chat API stores: system messages
  (`kind: "system"`) as a centered line, withdrawn messages as "Message
  removed", an "edited" mark, reactions, attachments as download links
  (http and https only), and internal notes (`visible_to`) with their own
  badge. System messages never count as the last reply for suggestions or
  "Seen".
- New labels `edited`, `removed` and `internalNote` in all seven languages.
- `ChatMessage` types `kind`, `edited_at`, `deleted_at`, `reactions`,
  `attachments` and `visible_to`.

## 0.2.0

- `@hibira-io/chat-ui/hibira`: a client for the Hibira Chat API's user routes
  (`createChatClient`): conversations with unread counts, messages, search,
  send, edit, delete, reactions, read receipts, typing, reports and
  attachment uploads, with a user token (string, function or `tokenUrl`,
  renewed before it expires and after a 401).
- `chatConversation()` and the React hook `useChatConversation()`: a Chat API
  conversation for `<Chat>`, kept live from `pusher.user` events.

## 0.1.0

First release.

- Chat protocol v1 ([PROTOCOL.md](PROTOCOL.md)): your backend stores the
  messages, the Hibira channel carries `message` and `typing` hints, with the
  agent's steps.
- Markdown for chat messages as data (`parseMarkdown`), rendered without HTML:
  safe links only, images inline only from allowed origins.
- `createConversation()`: messages kept current from hints, with polling as
  the safety net.
- React `ChatThread` and `Chat`: agent steps, replies revealed as typed,
  follow-up suggestions, copy buttons, handoff badge, reply box; seven
  languages, light and dark.
- Server helpers: `createChatServer()` (hints and `agentTyping()` steps),
  `cleanSuggestions()`, `agentMetadata()`.
