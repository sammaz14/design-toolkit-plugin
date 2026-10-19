import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fill } from '../skills/design-spec/scripts/fill.mjs';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'design-spec', 'assets');
const block = (page, id) => JSON.parse(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(page)[1]);

test('fill replaces the sheet and card data blocks and round-trips the data', () => {
  const data = { title: 'Synthetic', screens: [] };
  assert.deepEqual(block(fill(readFileSync(join(ASSETS, 'sheet.html'), 'utf8'), data), 'sheet-data'), data);
  assert.deepEqual(block(fill(readFileSync(join(ASSETS, 'card.html'), 'utf8'), data), 'card-data'), data);
});

test('text in the data cannot close the script block, and replacement patterns stay literal', () => {
  const data = { summary: '</script><img src=x onerror=alert(1)>', note: '$1 $& $`' };
  const page = fill(readFileSync(join(ASSETS, 'sheet.html'), 'utf8'), data);
  assert.equal(page.match(/<\/script>/g).length, readFileSync(join(ASSETS, 'sheet.html'), 'utf8').match(/<\/script>/g).length);
  assert.deepEqual(block(page, 'sheet-data'), data);
});

test('--title sets an escaped title, and a template with no data block is refused', () => {
  const page = fill(readFileSync(join(ASSETS, 'sheet.html'), 'utf8'), {}, 'A <b> & Co');
  assert.match(page, /<title>A &lt;b> &amp; Co<\/title>/);
  assert.match(fill(readFileSync(join(ASSETS, 'sheet.html'), 'utf8'), {}, 'Cost $& Fees $$'), /<title>Cost \$&amp; Fees \$\$<\/title>/);
  assert.throws(() => fill('<p>no block</p>', {}), /no sheet-data or card-data block/);
});
