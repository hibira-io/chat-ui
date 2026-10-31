import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { ChatThread } from '../react.js';
const D = process.argv[2];
const now = new Date(Date.now() - 60_000).toISOString();
const sets = {
  en: [
    { seq: 1, sender: 'customer', text: 'Do presence channels work on the Pro plan? We use Laravel Echo.', created_at: now },
    { seq: 2, sender: 'agent', name: 'Support', created_at: now, metadata: { assistant: true, suggestions: ['How many members can a presence channel have?', 'How do I move from Pusher?', 'Is there a free plan?'] },
      text: 'Yes. Pro includes **presence channels**. With Laravel Echo, change two options:\n\n1. `wsHost`: your app host\n2. `forceTLS`: `true`\n\n```js\nnew Echo({\n  broadcaster: "pusher",\n  wsHost: "ws.example.com",\n  forceTLS: true,\n});\n```\n\nThe full steps are in the [Laravel guide](https://example.com/guides/laravel).' },
  ],
  'zh-TW': [
    { seq: 1, sender: 'customer', text: 'Pro 方案可以用 presence channel 嗎？我們用 Laravel Echo。', created_at: now },
    { seq: 2, sender: 'agent', name: '客服助手', created_at: now, metadata: { assistant: true, suggestions: ['presence 頻道最多幾位成員？', '怎麼從 Pusher 搬過來？', '有免費方案嗎？'] },
      text: '可以！Pro 方案支援 **presence channel**，Laravel Echo 只要改兩個設定：\n\n1. `wsHost` 設為你的 app 主機\n2. `forceTLS` 設為 `true`\n\n詳細步驟請看 [Laravel 指南](https://example.com/guides/laravel)。' },
    { seq: 3, sender: 'customer', text: '那我的帳單為什麼多扣了一筆？', created_at: now },
  ],
  ja: [
    { seq: 1, sender: 'customer', text: '請求書の金額がおかしいです', created_at: now },
    { seq: 2, sender: 'agent', name: 'サポート', created_at: now, metadata: { assistant: true, handoff: true }, text: 'ありがとうございます。担当チームに引き継ぎました。チームがここでお返事します。' },
  ],
};
const shots = [
  ['thread-en', 'en', sets.en, {}],
  ['steps-zh-TW', 'zh-TW', sets['zh-TW'], { typing: true, step: 'account' }],
  ['handoff-ja', 'ja', sets.ja, {}],
];
for (const [name, locale, messages, extra] of shots) {
  const body = renderToStaticMarkup(h(ChatThread, { locale, messages, onSend: async () => {}, origin: 'https://example.com', ...extra }));
  writeFileSync(`${D}/${name}.html`, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../styles.css"><style>html,body{margin:0}body{padding:20px;background:#fff}@media(prefers-color-scheme:dark){body{background:#191918}}.hb-chat{max-width:560px;margin:0 auto;--hb-chat-max-height:none}*{animation:none!important}</style></head><body>${body}</body></html>`);
}
