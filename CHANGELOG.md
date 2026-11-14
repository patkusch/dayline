# Changelog

All notable changes to this project are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `dayline --version` prints the version.
- Tests for every kind of secret the redactor hides.

## [0.1.0] - 2026-10-06

First version. It writes up your day from your Claude Code sessions and git commits, on your own machine.

- `--project` to look at one project, and `--json` for machine-readable output.
- Tokens used per project.
- A week view with one section per day and a weekly total.
- Fixed: a comparison inside code is no longer read as a written file.
