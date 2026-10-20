import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childPids, hostRestrictsUserNamespaces, launchBrowser, useBundledChromiumIfNeeded } from '../skills/design-spec/scripts/lib/launch-browser.mjs';

// The stderr tail cdp.mjs puts in its early-exit error, as an Ubuntu 24.04 host produced it.
const SANDBOX_FAILURE = 'Chrome exited early, code null\n[0101/000000.000000:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox! If you are running on Ubuntu 23.10+ or another Linux distro that has disabled unprivileged user namespaces with AppArmor, see https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md.';

const TAG = /^--design-toolkit-launch=\d+-\d+$/;

// Each attempt carries a unique tag switch last; the recorder keeps it apart so the other options compare plainly.
function recorder(outcomes) {
  const calls = [];
  const tags = [];
  const launch = async (opts) => {
    const args = [...opts.extraArgs];
    tags.push(args.pop());
    calls.push(args.length ? { ...opts, extraArgs: args } : {});
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, tags, launch };
}

test('retries once with --no-sandbox when the host blocks the sandbox, and says so', async () => {
  const { calls, launch } = recorder([new Error(SANDBOX_FAILURE), 'browser']);
  const warnings = [];
  const browser = await launchBrowser({ launch, warn: (line) => warnings.push(line), restricted: () => false });
  assert.equal(browser, 'browser');
  assert.deepEqual(calls, [{}, { extraArgs: ['--no-sandbox'] }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /--no-sandbox/);
});

test('keeps the sandbox when the first launch works', async () => {
  const { calls, launch } = recorder(['browser']);
  const browser = await launchBrowser({ launch, warn: () => assert.fail('no warning expected') });
  assert.equal(browser, 'browser');
  assert.deepEqual(calls, [{}]);
});

test('does not retry an unrelated launch failure', async () => {
  const { calls, launch } = recorder([new Error('No Chrome/Edge/Chromium found. Install one or set CHROME_PATH to its executable.')]);
  await assert.rejects(launchBrowser({ launch, warn: () => {} }), /No Chrome/);
  assert.deepEqual(calls, [{}]);
});

const STALL = 'Chrome did not start within 20s';

test('kills only the stalled attempt\'s tagged Chrome and retries once with a fresh profile', async () => {
  const { calls, tags, launch } = recorder([new Error(STALL), 'browser']);
  const asked = [];
  const killed = [];
  const warnings = [];
  const children = (tag) => { asked.push(tag); return [9]; };
  const browser = await launchBrowser({ launch, warn: (line) => warnings.push(line), children, kill: (pid) => killed.push(pid) });
  assert.equal(browser, 'browser');
  assert.deepEqual(calls, [{}, {}]);
  assert.ok(tags.every((tag) => TAG.test(tag)));
  assert.notEqual(tags[0], tags[1]);
  assert.deepEqual(asked, [tags[0]]);
  assert.deepEqual(killed, [9]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /fresh profile/);
});

test('surfaces a second stall instead of retrying again', async () => {
  const { calls, launch } = recorder([new Error(STALL), new Error(STALL)]);
  await assert.rejects(launchBrowser({ launch, warn: () => {}, children: () => [], kill: () => {} }), /did not start/);
  assert.equal(calls.length, 2);
});

test('keeps --no-sandbox on the retry when the sandboxed launch was blocked first', async () => {
  const { calls, launch } = recorder([new Error(SANDBOX_FAILURE), new Error(STALL), 'browser']);
  const browser = await launchBrowser({ launch, warn: () => {}, restricted: () => false, children: () => [], kill: () => {} });
  assert.equal(browser, 'browser');
  assert.deepEqual(calls, [{}, { extraArgs: ['--no-sandbox'] }, { extraArgs: ['--no-sandbox'] }]);
});

test('asks pgrep for this process\'s children that carry the tag, and none on Windows or when pgrep finds none', () => {
  const seen = [];
  assert.deepEqual(childPids('--t=1', 'darwin', (args) => { seen.push(args); return '41\n42\n'; }), [41, 42]);
  assert.deepEqual(seen, [['-P', String(process.pid), '-f', '--', '--t=1']]);
  assert.deepEqual(childPids('--t=1', 'linux', () => { throw new Error('exit 1'); }), []);
  assert.deepEqual(childPids('--t=1', 'win32', () => assert.fail('pgrep must not run on Windows')), []);
});

test('surfaces the second failure when --no-sandbox also fails', async () => {
  const { calls, launch } = recorder([new Error(SANDBOX_FAILURE), new Error('Chrome exited early, code 1')]);
  await assert.rejects(launchBrowser({ launch, warn: () => {} }), /code 1/);
  assert.equal(calls.length, 2);
});

test('points CHROME_PATH at the bundled Chromium only when no browser is installed', () => {
  const env = {};
  useBundledChromiumIfNeeded(env, () => '/usr/bin/chromium', () => '/cache/chrome');
  assert.equal(env.CHROME_PATH, undefined);
  useBundledChromiumIfNeeded(env, () => null, () => '/cache/chrome');
  assert.equal(env.CHROME_PATH, '/cache/chrome');
});

test('retries a bare early exit on a host that restricts user namespaces, since the FATAL line can fall out of the stderr tail', async () => {
  const bareExit = new Error('Chrome exited early, code null\n#12 0x55d0c1a2b3c4 (/cache/chrome+0x9b2b3c4)');
  const restrictedHost = recorder([bareExit, 'browser']);
  assert.equal(await launchBrowser({ launch: restrictedHost.launch, warn: () => {}, restricted: () => true }), 'browser');
  assert.deepEqual(restrictedHost.calls, [{}, { extraArgs: ['--no-sandbox'] }]);
  const openHost = recorder([new Error(bareExit.message)]);
  await assert.rejects(launchBrowser({ launch: openHost.launch, warn: () => {}, restricted: () => false }), /exited early/);
  assert.equal(openHost.calls.length, 1);
});

test('reads the AppArmor user-namespace restriction only on Linux', () => {
  assert.equal(hostRestrictsUserNamespaces('linux', () => '1\n'), true);
  assert.equal(hostRestrictsUserNamespaces('linux', () => '0\n'), false);
  assert.equal(hostRestrictsUserNamespaces('linux', () => { throw new Error('ENOENT'); }), false);
  assert.equal(hostRestrictsUserNamespaces('darwin', () => '1\n'), false);
});
