import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { findPlaywrightChromium, playwrightRoots } from '../skills/design-spec/scripts/lib/playwright-chromium.mjs';

function cache(files, mode = 0o755) {
  const root = mkdtempSync(join(tmpdir(), 'ms-playwright-'));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '');
    chmodSync(join(root, file), mode);
  }
  return root;
}

test('finds each layout Playwright has shipped', () => {
  const layouts = [
    'chromium-1200/chrome-linux/chrome',
    'chromium-1243/chrome-linux64/chrome',
    'chromium_headless_shell-1200/chrome-linux/headless_shell',
    'chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
    'chromium-1100/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ];
  for (const layout of layouts) {
    const root = cache([layout]);
    assert.equal(findPlaywrightChromium([root]), join(root, layout));
  }
});

test('prefers full Chromium over the headless shell, then the newest revision', () => {
  const root = cache([
    'chromium_headless_shell-1300/chrome-linux/headless_shell',
    'chromium-1200/chrome-linux/chrome',
    'chromium-1243/chrome-linux64/chrome',
  ]);
  assert.equal(findPlaywrightChromium([root]), join(root, 'chromium-1243/chrome-linux64/chrome'));
});

test('falls back to the headless shell when it is the only build', () => {
  const root = cache(['chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell', 'webkit-2100/pw_run.sh']);
  assert.equal(findPlaywrightChromium([root]), join(root, 'chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'));
});

test('skips a build folder with no executable and returns null when none has one', () => {
  const root = cache(['chromium-1300/chrome-linux/README', 'firefox-1500/firefox/firefox']);
  assert.equal(findPlaywrightChromium([root]), null);
  assert.equal(findPlaywrightChromium([]), null);
});

test('skips a file without its execute bit, such as a partial download', () => {
  const partial = cache(['chromium-1300/chrome-linux64/chrome'], 0o644);
  const good = cache(['chromium-1243/chrome-linux64/chrome']);
  assert.equal(findPlaywrightChromium([partial, good]), join(good, 'chromium-1243/chrome-linux64/chrome'));
});

test('ranks builds across every root, not root by root', () => {
  const first = cache(['chromium_headless_shell-1300/chrome-headless-shell-linux64/chrome-headless-shell']);
  const second = cache(['chromium-1243/chrome-linux64/chrome']);
  assert.equal(findPlaywrightChromium([first, second]), join(second, 'chromium-1243/chrome-linux64/chrome'));
});

test('reads the Windows default cache under LOCALAPPDATA', () => {
  const local = mkdtempSync(join(tmpdir(), 'localappdata-'));
  mkdirSync(join(local, 'ms-playwright'));
  assert.ok(playwrightRoots({ LOCALAPPDATA: local }).includes(join(local, 'ms-playwright')));
});
