import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSessions, shellWrites } from '../src/sessions.js';
import { digest, localDay } from '../src/digest.js';
import { render } from '../src/render.js';
import { redact } from '../src/redact.js';
import { summarize } from '../src/ollama.js';

const at = (min) => new Date(2026, 9, 6, 10, min).toISOString(); // 6 Oct 2026, local time
const user = (min, content, extra = {}) => ({ type: 'user', timestamp: at(min), origin: { kind: 'human' }, message: { role: 'user', content }, ...extra });
const edit = (min, file) => ({ type: 'assistant', timestamp: at(min), message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Edit', input: { file_path: file } }] } });

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'dayline-'));
  for (const [dir, lines] of Object.entries(files)) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, 's1.jsonl'), lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n'));
  }
  return root;
}

test('real requests are kept, tool results and automatic notices are not', () => {
  const root = fixture({
    p1: [
      { type: 'custom-title', customTitle: 'Fix login' },
      user(0, 'fix the login bug', { cwd: '/work/app' }),
      user(1, [{ type: 'tool_result', content: 'ok' }]),
      user(2, '<task-notification>done</task-notification>'),
      user(3, 'note', { origin: { kind: 'task-notification' } }),
      user(4, 'from a helper agent', { isSidechain: true }),
      user(5, 'and add a test'),
      '{"type":"user","timestamp":"2026-10-0', // half-written last line
    ],
  });
  const [s] = readSessions(root);
  assert.equal(s.title, 'Fix login');
  assert.deepEqual(s.events.filter((e) => e.prompt).map((e) => e.prompt), ['fix the login bug', 'and add a test']);
});

test('the digest counts active time, files and requests per project, and skips other days', () => {
  const root = fixture({
    p1: [user(0, 'start', { cwd: '/work/app' }), edit(5, '/work/app/a.js'), edit(8, '/work/app/a.js'), edit(9, '/work/app/b.js'), user(60, 'after a long break')],
    p2: [user(0, 'other thing', { cwd: '/work/site' }), { type: 'user', timestamp: new Date(2026, 9, 5, 10).toISOString(), origin: { kind: 'human' }, message: { content: 'yesterday' } }],
  });
  const d = digest(readSessions(root), { from: '2026-10-06', withGit: false });
  const app = d.projects.find((p) => p.name === 'app');
  assert.equal(app.activeMinutes, 9); // the 51-minute break is not counted
  assert.equal(app.filesChanged, 2);
  assert.equal(app.requestCount, 2);
  const site = d.projects.find((p) => p.name === 'site');
  assert.equal(site.requestCount, 1); // yesterday's message is left out
  assert.equal(d.projects[0].name, 'app'); // busiest first
});

test('commits for the day come from git, and only the right author', () => {
  const repo = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { env: { ...process.env, GIT_AUTHOR_DATE: at(30), GIT_COMMITTER_DATE: at(30) } });
  git('init', '-q');
  git('-c', 'user.name=Ada', '-c', 'user.email=a@x.io', 'commit', '-q', '--allow-empty', '-m', 'add login');
  git('-c', 'user.name=Bob', '-c', 'user.email=b@x.io', 'commit', '-q', '--allow-empty', '-m', 'bump deps');
  const root = fixture({ p: [user(0, 'go', { cwd: repo })] });
  const all = digest(readSessions(root), { from: '2026-10-06' }).projects[0].commits.map((c) => c.subject).sort();
  assert.deepEqual(all, ['add login', 'bump deps']);
  const ada = digest(readSessions(root), { from: '2026-10-06', author: 'Ada' }).projects[0].commits.map((c) => c.subject);
  assert.deepEqual(ada, ['add login']);
});

test('a folder that no longer exists does not break the digest', () => {
  const root = fixture({ p: [user(0, 'go', { cwd: '/no/such/folder' })] });
  assert.equal(digest(readSessions(root), { from: '2026-10-06' }).projects[0].commits.length, 0);
});

test('secrets are hidden in requests and commit subjects', () => {
  const key = 'sk-' + 'a'.repeat(30);
  assert.equal(redact(`use ${key} now`), 'use [hidden] now');
  assert.match(redact('password=hunter2 ok'), /password=\[hidden\]/);
  assert.match(redact('ghp_' + 'b'.repeat(30)), /\[hidden\]/);
  const root = fixture({ p: [user(0, `deploy with ${key}`, { cwd: '/x/app' })] });
  const text = render(digest(readSessions(root), { from: '2026-10-06', withGit: false }));
  assert.ok(!text.includes(key));
});

test('an empty day says so', () => {
  assert.match(render(digest([], { from: '2026-10-06' })), /Nothing recorded/);
});

test('a missing sessions folder gives an empty list', () => {
  assert.deepEqual(readSessions('/no/such/root'), []);
});

test('summarize sends the digest to the local model and returns its answer', async () => {
  let seen;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => { seen = JSON.parse(body); res.end(JSON.stringify({ response: ' Done: fixed login. ' })); });
  }).listen(0);
  const host = `http://localhost:${server.address().port}`;
  assert.equal(await summarize('# notes', { model: 'tiny', host }), 'Done: fixed login.');
  assert.equal(seen.model, 'tiny');
  assert.match(seen.prompt, /do not invent/);
  server.close();
});

test('summarize explains itself when no model is running', async () => {
  await assert.rejects(summarize('x', { model: 'm', host: 'http://localhost:1' }), /Could not reach a model/);
});

test('localDay gives a calendar day', () => {
  assert.match(localDay(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
});

const bash = (min, command) => ({ type: 'assistant', timestamp: at(min), message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });

test('files written by shell commands are found, as a labelled guess', () => {
  assert.deepEqual(shellWrites("cat > src/a.js <<'EOF'\nx\nEOF\necho hi >> notes.md && cp a.txt out/b.txt && ls | tee log.txt && echo x > /dev/null").sort(), ['log.txt', 'notes.md', 'out/b.txt', 'src/a.js']);
  const root = fixture({ p: [user(0, 'go', { cwd: '/work/app' }), edit(1, '/work/app/a.js'), bash(2, 'cat > /work/app/a.js <<EOF\nx\nEOF'), bash(3, 'echo 1 > /work/app/new.txt')] });
  const p = digest(readSessions(root), { from: '2026-10-06', withGit: false }).projects[0];
  assert.equal(p.filesChanged, 1);
  assert.equal(p.shellFiles, 1); // a.js is already counted, new.txt is not
  assert.match(render({ from: '2026-10-06', to: '2026-10-06', projects: [p], totalMinutes: p.activeMinutes }), /\+1 written by shell commands, a guess/);
});

test('--project keeps only matching folders, and --json gives data', () => {
  const root = fixture({ a: [user(0, 'x', { cwd: '/w/my-app' })], b: [user(0, 'y', { cwd: '/w/website' })] });
  const d = digest(readSessions(root), { from: '2026-10-06', withGit: false, project: 'APP' });
  assert.deepEqual(d.projects.map((p) => p.name), ['my-app']);
  const out = execFileSync('node', ['bin/dayline.js', '--day', '2026-10-06', '--root', root, '--no-git', '--json', '--project', 'site']).toString();
  assert.deepEqual(JSON.parse(out).projects.map((p) => p.name), ['website']);
});

test('token use is added up once per reply, even when a reply is split over several records', () => {
  const reply = (min, id, tools) => ({ type: 'assistant', timestamp: at(min), message: { id, role: 'assistant', content: tools, usage: { input_tokens: 100, cache_creation_input_tokens: 400, output_tokens: 250 } } });
  const root = fixture({ p: [user(0, 'go', { cwd: '/w/app' }), reply(1, 'm1', []), reply(1, 'm1', []), reply(2, 'm2', [])] });
  const p = digest(readSessions(root), { from: '2026-10-06', withGit: false }).projects[0];
  assert.equal(p.tokens, 2 * (100 + 400 + 250));
});

test('--week gives one section per day that had work, under a weekly total', () => {
  const day = (offset, min) => new Date(Date.now() - offset * 86400000 + min * 60000).toISOString();
  const rec = (offset, text) => ({ type: 'user', timestamp: day(offset, 0), origin: { kind: 'human' }, cwd: '/w/app', message: { content: text } });
  const root = fixture({ p: [rec(0, 'today work'), rec(2, 'two days ago'), rec(30, 'long ago')] });
  const out = execFileSync('node', ['bin/dayline.js', '--week', '--root', root, '--no-git']).toString();
  assert.match(out, /^# Week /);
  assert.equal(out.match(/^### /gm).length, 2);
  assert.match(out, /today work/);
  assert.doesNotMatch(out, /long ago/);
});

test('comparisons and numbers in code are not mistaken for files', () => {
  assert.deepEqual(shellWrites('python3 -c "print(1 if x > 0.5 else 2)"; node -e "a > b.c"; echo ok > real.txt'), ['real.txt']);
});
