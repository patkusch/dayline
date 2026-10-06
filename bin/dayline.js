#!/usr/bin/env node
import { readSessions, defaultRoot } from '../src/sessions.js';
import { digest, localDay } from '../src/digest.js';
import { render } from '../src/render.js';
import { summarize } from '../src/ollama.js';

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') opt.help = true;
  else if (a === '--week') opt.week = true;
  else if (a === '--no-git') opt.noGit = true;
  else if (a === '--json') opt.json = true;
  else if (a === '--summarize') opt.model = args[++i];
  else if (['--day', '--root', '--author', '--project'].includes(a)) opt[a.slice(2)] = args[++i];
  else { console.error(`Unknown option ${a}. Try --help.`); process.exit(1); }
}
if (opt.help) {
  console.log(`dayline: your day, written up from Claude Code sessions and git commits

  dayline                     today
  dayline --day 2026-10-06    one day
  dayline --week              the last 7 days, today included
  dayline --author "Name"     only commits by this git author
  dayline --project NAME      only projects whose folder name contains NAME
  dayline --json              machine-readable output
  dayline --no-git            leave out commits
  dayline --summarize MODEL   ask a local Ollama model for a short standup
  dayline --root DIR          where Claude Code keeps sessions (default ~/.claude/projects)`);
  process.exit(0);
}
const today = localDay(Date.now());
const shift = (day, n) => localDay(new Date(`${day}T12:00:00`).getTime() + n * 86400000);
const from = opt.week ? shift(today, -6) : opt.day || today;
const to = opt.week ? today : opt.day || today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { console.error('Use a day like 2026-10-06.'); process.exit(1); }

try {
  const sessions = readSessions(opt.root || defaultRoot());
  if (opt.week && !opt.json) {
    const days = [];
    for (let n = 6; n >= 0; n--) days.push(shift(today, -n));
    const parts = days.map((day) => render(digest(sessions, { from: day, author: opt.author, withGit: !opt.noGit, project: opt.project })));
    const all = digest(sessions, { from, to, author: opt.author, withGit: false, project: opt.project });
    const head = `# Week ${from} to ${to}\n\n${all.projects.length} project${all.projects.length === 1 ? '' : 's'}, about ${Math.floor(all.totalMinutes / 60)} h ${all.totalMinutes % 60} min of active work.\n`;
    console.log([head, ...parts.filter((t) => !/Nothing recorded/.test(t)).map((t) => t.replace(/^# /, '### '))].join('\n'));
    process.exit(0);
  }
  const d = digest(sessions, { from, to, author: opt.author, withGit: !opt.noGit, project: opt.project });
  if (opt.json) { console.log(JSON.stringify(d, null, 2)); process.exit(0); }
  const text = render(d);
  console.log(opt.model ? await summarize(text, { model: opt.model }) : text);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
