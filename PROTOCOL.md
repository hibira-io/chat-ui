# Chat protocol v1

How the `@hibira-io/chat-ui` components talk to your backend and to a
[Hibira](https://hibira.io) channel. Any backend can implement it; the
`server` helpers do the channel side for Node.

## Principles

- **Your backend stores messages.** Pages read them over HTTPS from your
  routes (the `load` and `send` functions you pass to `createConversation`).
- **The channel carries hints only**: small events that say "something
  changed". A page that misses one catches up on its next poll, so a lost
  event never loses a message, and message text never crosses the socket.
- One channel per conversation. Use a private channel (for example
  `private-chat.{conversationId}`) and authorize only the people in it.

## Message

```json
{
  "id": "msg_01",
  "seq": 7,
  "sender": "agent",
  "name": "Support",
  "text": "Markdown text",
  "created_at": "2026-10-31T12:00:00Z",
  "metadata": { "assistant": true, "suggestions": ["Is there a free plan?"] }
}
```

| Field | Meaning |
| --- | --- |
| `seq` | Position in the conversation, increasing by one. Pages ask for messages after the last `seq` they have. |
| `sender` | `customer` for the person using the chat (the page's `me`), anything else for your side (`agent`, `operator`, ...). |
| `text` | Markdown. Pages render it without HTML (see the README). |
| `metadata.assistant` | `true` on a reply your agent wrote: shown as an automatic reply. |
| `metadata.handoff` | `true` when the agent passed the conversation to a person. |
| `metadata.suggestions` | Up to 3 follow-up questions; the customer sends one with a tap. Clean them with `cleanSuggestions()`. |

## Routes (yours)

- `load(after)`: return `{ messages: Message[] }` with the messages whose
  `seq > after`, oldest first. Anything else you return (status, read
  marks) shows up as `state.extra`.
- `send(text)`: store the customer's message and return it (or
  `{ message }`). Then send the `message` hint.

## Events on the conversation's channel

| Event | Data | Sent when |
| --- | --- | --- |
| `message` | `{ "seq": 7, "from": "agent" }` | A message was stored. Pages read what they have not seen. |
| `typing` | `{ "from": "agent", "step": "writing" }` | Someone is writing. Repeat every ~4 s while it lasts; pages hide it after 8 s without one, or when that side's message arrives. |
| anything else | your data | Passed to `onEvent` (status changes, read marks, ...). |

### Agent steps

While your agent writes a reply, send `typing` with a `step` each time it
moves on. Pages show the steps so far with a check and the current one with
a spinner. Send only steps your agent really takes:

| Step | Shown as (en) |
| --- | --- |
| `reading` | Reading your question |
| `account` | Looking at your account |
| `searching` | Searching our docs |
| `writing` | Writing a reply |
| `checking` | Checking the reply |

Other step names show as plain typing unless you add labels for them
(`labels.steps`).
