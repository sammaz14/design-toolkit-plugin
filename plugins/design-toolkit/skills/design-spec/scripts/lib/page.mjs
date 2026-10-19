// Page setup shared by capture.mjs and the ui-inspect skill, so a measured check sees the same page as the shot.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sleep } from './cdp.mjs';

export const VIEWPORTS = { desktop: { width: 1280, height: 800 }, narrow: { width: 400, height: 800 } };
const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

export function parseViewport(spec) {
  if (VIEWPORTS[spec]) return { name: spec, ...VIEWPORTS[spec] };
  const m = /^(\d+)x(\d+)$/.exec(spec);
  if (!m) throw new Error(`viewport "${spec}": use desktop, narrow, or WIDTHxHEIGHT`);
  return { name: spec, width: Number(m[1]), height: Number(m[2]) };
}

export function parseTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') throw new Error(`theme "${theme}": use light or dark`);
  return theme;
}

export function toUrl(target) {
  // A one-letter scheme is a Windows drive (C:\...), not a URL.
  return /^[a-z][a-z0-9+.-]+:/i.test(target) ? target : pathToFileURL(resolve(target)).href;
}

async function waitForSelector(page, selector, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.eval((s) => !!document.querySelector(s), selector)) return;
    await sleep(100);
  }
  throw new Error(`--wait-for "${selector}" did not appear within ${timeoutMs}ms`);
}

// Two animation frames plus font readiness: the page is read only after a real paint of the final layout.
function settleFrame(page) {
  return page.eval(() => document.fonts.ready.then(() => new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(done));
  })));
}

export async function preparePage(page, opts, theme) {
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  if (opts.cookies) await page.send('Network.setCookies', { cookies: opts.cookies });
  await page.goto(opts.url, { settleMs: 0 });
  await page.eval((css) => document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css })), FREEZE_CSS);
  if (opts.themeAttr) {
    await page.eval((a) => document.documentElement.setAttribute(a.name, a.value), { name: opts.themeAttr, value: theme });
  }
  if (opts.waitFor) await waitForSelector(page, opts.waitFor);
  // Script-driven states leave focus where the script put it, drawing a ring a person never sees.
  if (opts.blur) await page.eval(() => document.activeElement && document.activeElement.blur());
  await sleep(opts.settleMs);
  await settleFrame(page);
}
