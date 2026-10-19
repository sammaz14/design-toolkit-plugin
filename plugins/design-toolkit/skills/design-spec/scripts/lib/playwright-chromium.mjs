// Finds a Chromium that Playwright downloaded, for hosts with Playwright but no installed Chrome.
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BUILD_DIR = /^(chromium|chromium_headless_shell)-(\d+)$/;

// Playwright has shipped both its own Chromium layout and the Chrome for Testing layout.
const EXECUTABLES = [
  'chrome',
  'headless_shell',
  'chrome-headless-shell',
  'chrome.exe',
  'chrome-headless-shell.exe',
  'Chromium.app/Contents/MacOS/Chromium',
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
];

export function playwrightRoots(env = process.env) {
  const home = homedir();
  return [
    env.PLAYWRIGHT_BROWSERS_PATH,
    join(home, '.cache', 'ms-playwright'),
    join(home, 'Library', 'Caches', 'ms-playwright'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'ms-playwright'),
  ].filter((root) => root && existsSync(root));
}

function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

// An interrupted download can leave the file without its execute bit; skip it rather than fail at launch.
function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Across every root: full Chromium before the headless shell, then the newest revision first.
function rankBuilds(roots) {
  return roots
    .flatMap((root) => listDirs(root).map((name) => ({ root, match: BUILD_DIR.exec(name) })))
    .filter(({ match }) => match)
    .map(({ root, match: [name, kind, rev] }) => ({ dir: join(root, name), shell: kind !== 'chromium', rev: Number(rev) }))
    .sort((a, b) => a.shell - b.shell || b.rev - a.rev);
}

function executableIn(buildDir) {
  for (const platformDir of listDirs(buildDir)) {
    const found = EXECUTABLES.map((exe) => join(buildDir, platformDir, exe)).find(isExecutable);
    if (found) return found;
  }
  return null;
}

export function findPlaywrightChromium(roots = playwrightRoots()) {
  for (const build of rankBuilds(roots)) {
    const exe = executableIn(build.dir);
    if (exe) return exe;
  }
  return null;
}
