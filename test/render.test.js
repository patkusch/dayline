import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';

const project = (over = {}) => ({
  name: 'app',
  activeMinutes: 45,
  firstAt: new Date(2026, 9, 6, 9, 5).getTime(),
  lastAt: new Date(2026, 9, 6, 17, 40).getTime(),
  sessions: 2,
  tokens: 0,
  filesChanged: 3,
  shellFiles: 0,
  titles: [],
  commits: [],
  requests: [],
  requestCount: 0,
  ...over,
});

const day = (projects, over = {}) => ({ from: '2026-10-06', to: '2026-10-06', totalMinutes: projects.reduce((n, p) => n + p.activeMinutes, 0), projects, ...over });

test('a day with no work says so under the day as the heading', () => {
  assert.equal(render(day([])), '# 2026-10-06\n\nNothing recorded for this period.\n');
});

test('a period shows from and to; a single day shows just the day', () => {
  assert.match(render(day([project()], { to: '2026-10-12' })), /^# 2026-10-06 to 2026-10-12\n/);
  assert.match(render(day([project()])), /^# 2026-10-06\n/);
});

test('minutes read as minutes under an hour and as hours and minutes from an hour up', () => {
  assert.match(render(day([project({ activeMinutes: 59 })])), /about 59 min of active work\./);
  assert.match(render(day([project({ activeMinutes: 60 })])), /about 1 h 0 min of active work\./);
  assert.match(render(day([project({ activeMinutes: 135 })])), /about 2 h 15 min of active work\./);
});

test('one project is singular and several are plural, in the opening line', () => {
  assert.match(render(day([project()])), /\n1 project, about/);
  assert.match(render(day([project(), project({ name: 'site' })])), /\n2 projects, about/);
});

test('each project gets its time span, session count and file count with the right plurals', () => {
  const one = render(day([project({ sessions: 1, filesChanged: 1 })]));
  assert.match(one, /## app\n45 min between \d\d:\d\d and \d\d:\d\d · 1 session · 1 file changed/);
  const many = render(day([project({ sessions: 3, filesChanged: 0 })]));
  assert.match(many, /· 3 sessions · 0 files changed/);
});

test('token counts are shown in thousands: one decimal under ten thousand, none above, and left out at zero', () => {
  assert.match(render(day([project({ tokens: 1234 })])), /· 1\.2k tokens ·/);
  assert.match(render(day([project({ tokens: 9999 })])), /· 10\.0k tokens ·/);
  assert.match(render(day([project({ tokens: 12345 })])), /· 12k tokens ·/);
  assert.doesNotMatch(render(day([project({ tokens: 0 })])), /tokens/);
});

test('files written by shell commands are mentioned as a guess, and only when there are some', () => {
  assert.match(render(day([project({ shellFiles: 2 })])), /3 files changed \(\+2 written by shell commands, a guess\)/);
  assert.doesNotMatch(render(day([project()])), /shell/);
});

test('session titles are joined on one line, and left out when there are none', () => {
  assert.match(render(day([project({ titles: ['Fix login', 'Add test'] })])), /\nSessions: Fix login; Add test\n/);
  assert.doesNotMatch(render(day([project()])), /Sessions:/);
});

test('commits are listed with their short hash', () => {
  const md = render(day([project({ commits: [{ subject: 'Fix the bug', hash: 'abc1234' }, { subject: 'Add a test', hash: 'def5678' }] })]));
  assert.match(md, /\nCommits:\n- Fix the bug \(abc1234\)\n- Add a test \(def5678\)\n/);
});

test('requests are listed, and when only some are shown it says how many of how many', () => {
  const all = render(day([project({ requests: ['one', 'two'], requestCount: 2 })]));
  assert.match(all, /\nWhat you asked for:\n- one\n- two\n/);
  const some = render(day([project({ requests: ['one', 'two'], requestCount: 9 })]));
  assert.match(some, /\nWhat you asked for \(first 2 of 9\):\n- one\n- two\n/);
});

test('projects follow each other in the order given, each under its own heading', () => {
  const md = render(day([project({ name: 'busy' }), project({ name: 'quiet' })]));
  assert.ok(md.indexOf('## busy') < md.indexOf('## quiet'));
  assert.ok(md.endsWith('\n'));
});
