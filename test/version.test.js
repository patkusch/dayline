import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('--version prints the name and the number from package.json, then stops', () => {
  const want = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const r = spawnSync('node', ['bin/dayline.js', '--version'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `dayline ${want}`);
});
