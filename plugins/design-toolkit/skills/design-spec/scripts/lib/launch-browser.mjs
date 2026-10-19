import { readFileSync } from 'node:fs';
import { Browser, findChrome } from './cdp.mjs';
import { findPlaywrightChromium } from './playwright-chromium.mjs';

// Ubuntu 23.10+ blocks the unprivileged user namespaces Chromium's sandbox needs; Playwright passes --no-sandbox on Linux for the same reason.
const NO_SANDBOX = /No usable sandbox/i;
const USERNS_RESTRICTION = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns';

// cdp.mjs stays byte-identical to upstream, so the Playwright fallback reaches it through CHROME_PATH.
export function useBundledChromiumIfNeeded(env = process.env, findInstalled = findChrome, findBundled = findPlaywrightChromium) {
  if (findInstalled()) return;
  const bundled = findBundled();
  if (bundled) env.CHROME_PATH = bundled;
}

export function hostRestrictsUserNamespaces(platform = process.platform, read = (path) => readFileSync(path, 'utf8')) {
  if (platform !== 'linux') return false;
  try {
    return read(USERNS_RESTRICTION).trim() === '1';
  } catch {
    return false;
  }
}

// cdp.mjs keeps only the last 600 characters of stderr, and the abort's stack trace can push the FATAL line out of them.
function sandboxBlocked(err, restricted) {
  return NO_SANDBOX.test(err.message) || (restricted() && /exited early/.test(err.message));
}

export async function launchBrowser({
  launch = (opts) => Browser.launch(opts),
  warn = console.error,
  restricted = hostRestrictsUserNamespaces,
} = {}) {
  try {
    return await launch({});
  } catch (err) {
    if (!sandboxBlocked(err, restricted)) throw err;
    warn('capture: this host blocks the Chromium sandbox, so the capture runs with --no-sandbox. Capture only pages you trust.');
    return launch({ extraArgs: ['--no-sandbox'] });
  }
}
