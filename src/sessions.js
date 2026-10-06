// Read Claude Code's session files (one JSON record per line) into plain events.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

export const defaultRoot = () => join(homedir(), '.claude', 'projects');

const NOISE = /^<(system-reminder|task-notification|command-name|local-command|ide_)/;

// A real request from the person: typed by a human, not a tool result or an automatic notice.
function humanText(rec) {
  if (rec.type !== 'user' || rec.isSidechain) return null;
  if (rec.origin && rec.origin.kind && rec.origin.kind !== 'human') return null;
  const c = rec.message?.content;
  let text = typeof c === 'string' ? c
    : Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';
  text = text.replace(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>/g, '[pasted text]').trim();
  if (!text || NOISE.test(text) || /^\[SYSTEM NOTIFICATION/.test(text)) return null;
  return text;
}

// Files a shell command writes to, best guess: `> file`, `>> file`, `tee file`, `cp/mv ... file`.
export function shellWrites(cmd) {
  const out = new Set();
  const clean = (p) => p.replace(/^['"]|['"]$/g, '');
  for (const m of cmd.matchAll(/(?:^|[\s;&|])>>?\s*(['"]?[~\w./-]+\.\w+['"]?)/g)) out.add(clean(m[1]));
  for (const m of cmd.matchAll(/\btee\s+(?:-a\s+)?(['"]?[~\w./-]+\.\w+['"]?)/g)) out.add(clean(m[1]));
  for (const m of cmd.matchAll(/\b(?:cp|mv)\s+(?:-\w+\s+)*\S+\s+(['"]?[~\w./-]+\.\w+['"]?)/g)) out.add(clean(m[1]));
  // A real file name starts with a letter, dot, slash or ~ and has a word as its ending. This drops "> 0.5" and "> 12.5%".
  return [...out].filter((f) => !f.startsWith('/dev/') && /^[A-Za-z_~./][\w./-]*\.[A-Za-z]\w*$/.test(f));
}

function shellFiles(rec) {
  if (rec.type !== 'assistant' || !Array.isArray(rec.message?.content)) return [];
  return rec.message.content.filter((b) => b.type === 'tool_use' && b.name === 'Bash' && b.input?.command).flatMap((b) => shellWrites(b.input.command));
}

function touched(rec) {
  if (rec.type !== 'assistant' || !Array.isArray(rec.message?.content)) return [];
  return rec.message.content
    .filter((b) => b.type === 'tool_use' && ['Edit', 'Write', 'NotebookEdit'].includes(b.name))
    .map((b) => b.input?.file_path || b.input?.notebook_path)
    .filter(Boolean);
}

const tokensOf = (rec) => {
  const u = rec.type === 'assistant' && rec.message?.usage;
  return u ? { input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), output: u.output_tokens || 0 } : null;
};

export function readSessions(root = defaultRoot()) {
  if (!existsSync(root)) return [];
  const sessions = [];
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of readdirSync(join(root, dir.name))) {
      if (!f.endsWith('.jsonl')) continue;
      const events = [];
      let cwd = null, title = null;
      const seen = new Set(); // one reply can be written as several records; count its usage once
      for (const line of readFileSync(join(root, dir.name, f), 'utf8').split('\n')) {
        if (!line) continue;
        let rec;
        try { rec = JSON.parse(line); } catch { continue; } // a half-written last line is normal
        if (rec.type === 'custom-title' && rec.customTitle) title = rec.customTitle;
        if (rec.cwd && !cwd) cwd = rec.cwd;
        if (!rec.timestamp) continue;
        const t = Date.parse(rec.timestamp);
        if (Number.isNaN(t)) continue;
        const prompt = humanText(rec);
        let tokens = null;
        const id = rec.message?.id;
        if (!id || !seen.has(id)) { tokens = tokensOf(rec); if (id) seen.add(id); }
        events.push({ t, prompt, files: touched(rec), shell: shellFiles(rec), tokens });
      }
      if (events.length) {
        events.sort((a, b) => a.t - b.t);
        sessions.push({ id: basename(f, '.jsonl'), cwd: cwd || dir.name, title, events });
      }
    }
  }
  return sessions;
}
