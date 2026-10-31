# Changelog

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
