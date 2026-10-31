import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../react.js';
import { imageSrc, parseMarkdown, plainText, safeHref } from '../index.js';

const html = (text, props = {}) => renderToStaticMarkup(h(Markdown, { text, origin: 'https://example.com', ...props })).replace(/^<div class="hb-chat-md">|<\/div>$/g, '');
const LINK = 'target="_blank" rel="noopener noreferrer nofollow ugc"';

test('plain text keeps its line breaks', () => {
  assert.equal(html('Hi there\nsecond line\n\nnew paragraph'), '<p>Hi there<br/>second line</p><p>new paragraph</p>');
});

test('inline formatting', () => {
  assert.equal(html('**bold** *it* _it_ ~~gone~~ `a*b*c`'), '<p><strong>bold</strong> <em>it</em> <em>it</em> <del>gone</del> <code>a*b*c</code></p>');
  assert.equal(html('**Plan `Pro`** costs'), '<p><strong>Plan <code>Pro</code></strong> costs</p>');
  assert.equal(html('snake_case_name'), '<p>snake_case_name</p>');
  assert.equal(html('\\*not italic\\*'), '<p>*not italic*</p>');
});

test('lists, nesting, quotes, headings, code, rules', () => {
  assert.equal(
    html('Steps:\n1. Sign up\n2. Create an app\n   - copy the key\n   - set the host'),
    '<p>Steps:</p><ol><li>Sign up</li><li>Create an app<ul><li>copy the key</li><li>set the host</li></ul></li></ol>',
  );
  assert.equal(html('3. three\n4. four'), '<ol start="3"><li>three</li><li>four</li></ol>');
  assert.equal(html('> quoted **text**'), '<blockquote><p>quoted <strong>text</strong></p></blockquote>');
  assert.equal(html('## Title\nbody'), '<p class="hb-chat-h"><strong>Title</strong></p><p>body</p>');
  const code = html('```js\nconst a = "<b>";\n```');
  assert.match(code, /<pre data-lang="js"><code>const a = &quot;&lt;b&gt;&quot;;<\/code><\/pre>/);
  assert.match(code, /aria-label="Copy code"/);
  assert.equal(html('a\n\n---\n\nb'), '<p>a</p><hr/><p>b</p>');
});

test('tables', () => {
  assert.equal(
    html('| Plan | Price |\n|---|--:|\n| Pro | $89 |'),
    '<div class="hb-chat-table"><table><thead><tr><th>Plan</th><th style="text-align:right">Price</th></tr></thead><tbody><tr><td>Pro</td><td style="text-align:right">$89</td></tr></tbody></table></div>',
  );
});

test('links are safe', () => {
  assert.equal(html('[Docs](https://example.com/docs)'), `<p><a href="https://example.com/docs" ${LINK}>Docs</a></p>`);
  assert.equal(html('see https://example.com/a.'), `<p>see <a href="https://example.com/a" ${LINK}>https://example.com/a</a>.</p>`);
  assert.match(html('（https://example.com/ja）'), /href="https:\/\/example.com\/ja"/);
  assert.equal(html('[x](javascript:alert(1))'), '<p>x</p>');
  assert.equal(html('[x](data:text/html,hi)'), '<p>x</p>');
  assert.equal(html('[x](//evil.example)'), '<p>x</p>');
  assert.equal(safeHref('JAVASCRIPT:alert(1)'), null);
  assert.equal(safeHref('/pricing'), '/pricing');
  assert.equal(safeHref('mailto:hi@example.com'), 'mailto:hi@example.com');
});

test('raw HTML stays text', () => {
  const out = html('<img src=x onerror=alert(1)> <script>alert(1)</script>');
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('<script'));
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('images: own origin inline, others as links', () => {
  assert.match(html('![chart](/a.png)'), /<img src="https:\/\/example.com\/a.png" alt="chart"/);
  const other = html('![chart](https://cdn.example.net/a.png)');
  assert.ok(!other.includes('<img'));
  assert.match(other, /class="hb-chat-imglink"/);
  assert.match(html('![c](https://cdn.example.net/a.png)', { imageOrigins: ['https://cdn.example.net'] }), /<img/);
  assert.equal(imageSrc('data:image/png;base64,AA', { origin: 'https://example.com' }), null);
  assert.equal(imageSrc('/a.png', { origin: '' }), null);
});

test('plainText drops the marks', () => {
  assert.equal(plainText('**Hi** see [docs](https://example.com)\n- a\n- b'), 'Hi see docs a · b');
});

test('parseMarkdown is plain data', () => {
  assert.deepEqual(parseMarkdown('**a**', { origin: '' }), [{ type: 'p', children: [{ type: 'strong', children: ['a'] }] }]);
});
