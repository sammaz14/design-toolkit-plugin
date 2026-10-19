#!/usr/bin/env node
// Measures a rendered app screen at the design-spec viewports and themes, and reports FAIL and WARN findings.
// Exit 0: no FAIL. Exit 1: at least one FAIL. Exit 2: the run itself failed.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { sleep } from '../../design-spec/scripts/lib/cdp.mjs';
import { launchBrowser, useBundledChromiumIfNeeded } from '../../design-spec/scripts/lib/launch-browser.mjs';
import { parseTheme, parseViewport, preparePage, toUrl } from '../../design-spec/scripts/lib/page.mjs';
import { frame, probe } from './lib/probe.mjs';
import { RULE_IDS, judge, merge } from './lib/rules.mjs';

const USAGE = `usage: node inspect.mjs --url <url|file>
  [--viewport desktop|narrow|WIDTHxHEIGHT]... [--theme light|dark]...
  [--theme-attr name] [--cookies file.json] [--wait-for css] [--settle ms] [--blur]
  [--screens n] [--allow rule]... [--ignore css]... [--json]
rules: ${RULE_IDS.join(', ')}`;

function count(name, value) {
  if (!/^\d+$/.test(value)) throw new Error(`--${name} "${value}": use a whole number`);
  return Number(value);
}

function readOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: 'string' },
      viewport: { type: 'string', multiple: true, default: ['desktop', 'narrow'] },
      theme: { type: 'string', multiple: true, default: ['light', 'dark'] },
      'theme-attr': { type: 'string' },
      cookies: { type: 'string' },
      'wait-for': { type: 'string' },
      settle: { type: 'string', default: '300' },
      blur: { type: 'boolean', default: false },
      screens: { type: 'string', default: '4' },
      allow: { type: 'string', multiple: true, default: [] },
      ignore: { type: 'string', multiple: true, default: [] },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || !values.url) return null;
  const unknown = values.allow.filter((id) => !RULE_IDS.includes(id));
  if (unknown.length) throw new Error(`--allow ${unknown.join(', ')}: not a rule id`);
  return {
    target: values.url,
    url: toUrl(values.url),
    viewports: values.viewport.map(parseViewport),
    themes: values.theme.map(parseTheme),
    themeAttr: values['theme-attr'],
    cookies: values.cookies ? JSON.parse(readFileSync(values.cookies, 'utf8')) : null,
    waitFor: values['wait-for'],
    settleMs: count('settle', values.settle),
    blur: values.blur,
    screens: count('screens', values.screens),
    allow: values.allow,
    ignored: values.ignore,
    ignore: values.ignore.length ? values.ignore.join(', ') : null,
    json: values.json,
  };
}

// Text under a sticky bar or a late layer often shows only once the page scrolls, so each screen is read,
// and the page end always is: a bottom bar that hides text there hides it for good.
async function framesFor(page, height, maxScreens, ignore) {
  const maxScroll = await page.eval(() => document.documentElement.scrollHeight - innerHeight);
  const stops = Array.from({ length: maxScreens }, (_, i) => (i + 1) * height).filter((y) => y < maxScroll);
  if (maxScroll > 0) stops.push(maxScroll);
  const frames = [await page.eval(frame, ignore)];
  for (const y of stops) {
    await page.eval((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await sleep(150);
    frames.push(await page.eval(frame, ignore));
  }
  await page.eval(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return frames;
}

async function inspect(browser, opts, viewport, theme) {
  const page = await browser.newPage({ width: viewport.width, height: viewport.height, dsf: 1 });
  try {
    await preparePage(page, opts, theme);
    const metrics = await page.eval(probe, opts.ignore);
    const frames = await framesFor(page, viewport.height, opts.screens, opts.ignore);
    const where = `${viewport.name}/${theme}`;
    return judge(metrics, frames, { allow: opts.allow }).map((f) => ({ ...f, where }));
  } finally {
    await page.close();
  }
}

function printReport(report) {
  const fails = report.findings.filter((f) => f.level === 'FAIL');
  const warns = report.findings.filter((f) => f.level === 'WARN');
  console.log(`UI INSPECT  ${report.url}`);
  console.log(`ran: ${report.ran.join(', ')}${report.allow.length ? `   allowed: ${report.allow.join(', ')}` : ''}${report.ignore.length ? `   ignored: ${report.ignore.join(', ')}` : ''}`);
  for (const f of report.findings) {
    console.log(`\n${f.level} [${f.id}] at ${f.where.join(', ')}\n  ${f.message}\n  fix: ${f.fix}`);
  }
  console.log(`\nRESULT: ${fails.length} FAIL, ${warns.length} WARN`);
}

async function main() {
  const opts = readOptions(process.argv.slice(2));
  if (!opts) {
    console.log(USAGE);
    return 0;
  }
  useBundledChromiumIfNeeded();
  const browser = await launchBrowser();
  const found = [];
  const ran = [];
  try {
    for (const viewport of opts.viewports) {
      for (const theme of opts.themes) {
        found.push(...await inspect(browser, opts, viewport, theme));
        ran.push(`${viewport.name}/${theme}`);
      }
    }
  } finally {
    await browser.close();
  }
  const report = { url: opts.target, ran, allow: opts.allow, ignore: opts.ignored, findings: merge(found) };
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  return report.findings.some((f) => f.level === 'FAIL') ? 1 : 0;
}

// The vendored goto leaves its load-timeout timer armed, so an exit that waits for the event loop lingers.
main().then((code) => process.exit(code), (err) => {
  console.error(`inspect: ${err.message}`);
  process.exit(2);
});
