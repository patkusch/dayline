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

test('an unknown option is refused with a hint, not ignored', () => {
  const r = spawnSync('node', ['bin/dayline.js', '--nope'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown option --nope\. Try --help\./);
});

test('--help exits cleanly and prints the usage', () => {
  const r = spawnSync('node', ['bin/dayline.js', '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /dayline/);
});
