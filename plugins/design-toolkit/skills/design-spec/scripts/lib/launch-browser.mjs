import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Browser, findChrome } from './cdp.mjs';
import { findPlaywrightChromium } from './playwright-chromium.mjs';

// Ubuntu 23.10+ blocks the unprivileged user namespaces Chromium's sandbox needs; Playwright passes --no-sandbox on Linux for the same reason.
const NO_SANDBOX = /No usable sandbox/i;
const USERNS_RESTRICTION = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns';
// Under load a headless Chrome now and then never prints its DevTools line; a fresh launch starts within a few seconds.
const STALLED = /did not start within/;

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

let launches = 0;

// Chrome ignores a switch it does not know, so a unique one marks the process this attempt spawned.
function launchTag() {
  launches += 1;
  return `--design-toolkit-launch=${process.pid}-${launches}`;
}

export function childPids(tag, platform = process.platform, run = (args) => execFileSync('pgrep', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) {
  if (platform === 'win32') return [];
  try {
    return run(['-P', String(process.pid), '-f', '--', tag]).split('\n').filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

function killQuietly(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {}
}

function tagged(opts) {
  return { ...opts, extraArgs: [...(opts.extraArgs ?? []), launchTag()] };
}

// cdp.mjs rejects a stalled start without killing the Chrome it spawned, so the retry kills the child that carries this attempt's tag.
async function launchRetryingStall(launch, opts, { warn, children, kill }) {
  const first = tagged(opts);
  try {
    return await launch(first);
  } catch (err) {
    if (!STALLED.test(err.message)) throw err;
    for (const pid of children(first.extraArgs.at(-1))) kill(pid);
    warn('capture: Chrome did not start, so the capture tries once more with a fresh profile.');
    return launch(tagged(opts));
  }
}

export async function launchBrowser({
  launch = (opts) => Browser.launch(opts),
  warn = console.error,
  restricted = hostRestrictsUserNamespaces,
  children = childPids,
  kill = killQuietly,
} = {}) {
  const attempt = (opts) => launchRetryingStall(launch, opts, { warn, children, kill });
  try {
    return await attempt({});
  } catch (err) {
    if (!sandboxBlocked(err, restricted)) throw err;
    warn('capture: this host blocks the Chromium sandbox, so the capture runs with --no-sandbox. Capture only pages you trust.');
    return attempt({ extraArgs: ['--no-sandbox'] });
  }
}
