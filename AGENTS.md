# Working in dayline

Your day, written up from your Claude Code sessions and git commits. Runs on your machine.

## Run the tests

You need Node 20 or newer.

```bash
npm test
```

Every test should pass before you start and after you finish.

## Where things are

- `src/`: the code
- `bin/`: the command-line entry point
- `test/`: the tests

## Before you commit

- Make sure the tests pass.
- Put changes people will notice in `CHANGELOG.md`.
- Do not put real passwords, keys or private data in test files or examples. Use made-up ones.
