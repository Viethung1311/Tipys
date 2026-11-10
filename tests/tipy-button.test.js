import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogIn } from 'lucide-react';
import { JSDOM } from 'jsdom';
const compiled = buildSync({
  entryPoints: ['src/components/TipyButton.jsx'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['react', 'react/jsx-runtime', 'lucide-react'],
  loader: { '.css': 'empty' },
  jsx: 'automatic',
}).outputFiles[0].text;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  createRequire(import.meta.url),
  module,
  module.exports,
);
const TipyButton = module.exports.default;
function button(props) {
  const dom = new JSDOM(renderToStaticMarkup(createElement(TipyButton, props, 'Đăng nhập')));
  return { dom, button: dom.window.document.querySelector('button') };
}
test('shared button keeps submit semantics, secondary style and meaningful custom icon', () => {
  const { dom, button: b } = button({
    type: 'submit',
    icon: LogIn,
    emphasis: 'secondary',
    'aria-describedby': 'help',
  });
  try {
    assert.equal(b.type, 'submit');
    assert.equal(b.disabled, false);
    assert.ok(b.classList.contains('tipy-button--secondary'));
    assert.ok(b.querySelector('svg.lucide-log-in'));
    assert.equal(b.querySelector('svg').getAttribute('aria-hidden'), 'true');
    assert.equal(b.getAttribute('aria-describedby'), 'help');
    assert.match(b.textContent, /Đăng nhập/);
  } finally {
    dom.window.close();
  }
});
test('busy button blocks duplicate actions and announces a readable processing label', () => {
  const { dom, button: b } = button({ loading: true, loadingLabel: 'Đang xử lý…', icon: LogIn });
  try {
    assert.equal(b.disabled, true);
    assert.equal(b.getAttribute('aria-busy'), 'true');
    assert.equal(b.textContent, 'Đang xử lý…');
    assert.ok(b.querySelector('svg.lucide-hourglass'));
  } finally {
    dom.window.close();
  }
});
