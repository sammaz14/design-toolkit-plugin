#!/usr/bin/env node
// Fills a design-spec template's JSON block from a data file and writes a new page. Run through a shell so
// no editor tool writes the .html: on the Claude desktop app, writing an .html file opens the preview pane.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BLOCK = /(<script type="application\/json" id="(?:sheet|card)-data">)[\s\S]*?(<\/script>)/;

// "<" is escaped so no string in the data can close the script block early.
export function fill(template, data, title) {
  if (!BLOCK.test(template)) throw new Error('the template has no sheet-data or card-data block');
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  let page = template.replace(BLOCK, (_, open, close) => `${open}\n${json}\n${close}`);
  if (title !== undefined) {
    const safe = title.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
    page = page.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${safe}</title>`);
  }
  return page;
}

function main(argv) {
  const [template, dataFile, out, ...rest] = argv;
  if (!template || !dataFile || !out) {
    console.error('usage: node fill.mjs <template.html> <data.json> <out.html> [--title "Two To Four Words"]');
    return 2;
  }
  const titleAt = rest.indexOf('--title');
  const title = titleAt === -1 ? undefined : rest[titleAt + 1];
  writeFileSync(out, fill(readFileSync(template, 'utf8'), JSON.parse(readFileSync(dataFile, 'utf8')), title));
  console.log(out);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(`fill: ${err.message}`);
    process.exitCode = 1;
  }
}
