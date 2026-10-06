# Dayline

Your day, written up for you. Dayline reads the work history Claude Code already keeps on your computer, adds your git commits, and prints a short standup or weekly recap.

```bash
node bin/dayline.js                  # today
node bin/dayline.js --week           # the last 7 days
node bin/dayline.js --day 2026-10-06 # one day
```

It needs Node 20 or newer. No install, no account, no key. Nothing leaves your computer.

## What you get

For each project you worked on: how long you were active, when you started and stopped, how many sessions, how many files were changed, the commits you made, and what you asked for. Time counts only stretches of work; a gap of more than 15 minutes is treated as a break.

```
## my-app
1 h 12 min between 09:41 and 11:20 · 3 sessions · 8 files changed

Commits:
- add login rate limit (a1b2c3d)

What you asked for:
- fix the login bug
- and add a test
```

## A written standup, still on your machine

If you run [Ollama](https://ollama.com), Dayline can turn the digest into a three-line standup (Done, In progress, Blocked):

```bash
node bin/dayline.js --summarize llama3.2
```

The model is told to use only what the notes say. Read the result before you send it: small models still get things wrong.

## Options

| Option | What it does |
|---|---|
| `--author "Name"` | only your commits, when a repo has other people |
| `--no-git` | leave out commits |
| `--root DIR` | where Claude Code keeps sessions (default `~/.claude/projects`) |

## Privacy

- Dayline only reads. It never changes your sessions or your repos.
- Anything that looks like a key or token (`sk-…`, `ghp_…`, `password=…`) is hidden in the output. This is a safety net, not a promise. Read the output before you share it.
- Only your own typed requests are shown, not the AI's replies and not tool output.

## Honest limits

- Files changed counts only files Claude Code edited with its own edit tools. Files created through shell commands are not counted.
- Time is an estimate from timestamps. It cannot know you were thinking.
- It reads Claude Code's current file format. If that format changes, Dayline needs updating; the tests pin the format it expects.
- The model summary was tested against a fake local server, not a real model.

## Tests

```bash
npm test
```

Covers: which messages count as yours, active-time maths, per-day filtering, commits by author, a missing repo, hidden secrets, and the model call. CI runs it on Node 20, 22 and 24.

## Licence

MIT
