import { basename } from 'node:path';
import { commits } from './git.js';
import { redact } from './redact.js';

const DAY = 24 * 3600 * 1000;
const IDLE_MS = 15 * 60 * 1000; // a gap longer than this is a break, not work

export const localDay = (t) => new Date(t).toLocaleDateString('sv'); // YYYY-MM-DD in the local time zone

function dayRange(day) {
  const start = new Date(`${day}T00:00:00`).getTime();
  return [start, start + DAY];
}

// Active time: add up the gaps between events, ignoring breaks.
function activeMs(times) {
  let total = 0;
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] <= IDLE_MS) total += times[i] - times[i - 1];
  return total;
}

export function digest(sessions, { from, to = from, author, withGit = true, maxPrompts = 6 } = {}) {
  const [start] = dayRange(from);
  const [, end] = dayRange(to);
  const byProject = new Map();
  for (const s of sessions) {
    const events = s.events.filter((e) => e.t >= start && e.t < end);
    if (!events.length) continue;
    const name = basename(s.cwd);
    const p = byProject.get(s.cwd) || { name, cwd: s.cwd, sessions: 0, times: [], prompts: [], files: new Set(), titles: [] };
    p.sessions++;
    if (s.title) p.titles.push(s.title);
    for (const e of events) {
      p.times.push(e.t);
      if (e.prompt) p.prompts.push({ t: e.t, text: e.prompt });
      e.files.forEach((f) => p.files.add(f));
    }
    byProject.set(s.cwd, p);
  }
  const projects = [...byProject.values()].map((p) => {
    p.times.sort((a, b) => a - b);
    p.prompts.sort((a, b) => a.t - b.t);
    return {
      name: p.name,
      cwd: p.cwd,
      sessions: p.sessions,
      titles: [...new Set(p.titles)],
      firstAt: p.times[0],
      lastAt: p.times.at(-1),
      activeMinutes: Math.round(activeMs(p.times) / 60000),
      requests: p.prompts.slice(0, maxPrompts).map((q) => redact(q.text.replace(/\s+/g, ' ').slice(0, 160))),
      requestCount: p.prompts.length,
      filesChanged: p.files.size,
      commits: withGit ? commits(p.cwd, start, end, author).map((c) => ({ ...c, subject: redact(c.subject) })) : [],
    };
  }).sort((a, b) => b.activeMinutes - a.activeMinutes);
  return { from, to, projects, totalMinutes: projects.reduce((n, p) => n + p.activeMinutes, 0) };
}
