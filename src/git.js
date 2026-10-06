import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Commit subjects in a folder between two times. Not a git folder, or git missing: no commits, no error.
export function commits(cwd, sinceMs, untilMs, author) {
  if (!existsSync(cwd)) return [];
  const args = ['-C', cwd, 'log', `--since=${new Date(sinceMs).toISOString()}`, `--until=${new Date(untilMs).toISOString()}`, '--format=%h\t%s'];
  if (author) args.push(`--author=${author}`);
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(Boolean).map((l) => { const [hash, ...s] = l.split('\t'); return { hash, subject: s.join('\t') }; });
  } catch { return []; }
}
