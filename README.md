# Relayroom

Relayroom is a local-first context handoff tool for developers who switch between Claude Code, Cursor, Codex, and other AI coding agents.

It creates one shared source of truth in your repo:

- `.relayroom/HANDOFF.md` for the current task state
- `.relayroom/notes.md` for durable project memory
- adapter files for `AGENTS.md`, `CLAUDE.md`, and Cursor rules

The result: when one tool runs out of context or you want a second model to review the work, the next tool starts with the same handoff instead of a blank room.

## Install From GitHub

```sh
npm install -g github:toyeshhm/relayroom
```

Or run from a local checkout:

```sh
npm link
relayroom --help
```

## Quick Start

```sh
relayroom init
relayroom adapters install
relayroom note "Auth uses Supabase. Keep service role keys server-only."
relayroom capture --task "Build checkout flow" --note "Cart UI done; payment webhook still needs tests."
relayroom resume codex --print
```

## How It Transfers Context

Relayroom does not depend on private APIs from any AI vendor. It uses the files the tools already read:

- Codex reads `AGENTS.md`
- Claude Code reads `CLAUDE.md`
- Cursor reads `.cursor/rules/*.mdc`

Each adapter points to `.relayroom/HANDOFF.md`, so every tool loads the same current state.

## Commands

```sh
relayroom init
relayroom adapters install
relayroom note "fact"
relayroom capture --task "task" --note "state"
relayroom resume codex --print
relayroom resume claude --copy
relayroom pack --agent cursor --out handoff.md
relayroom status
```

## Safety

Relayroom is intentionally plain-text and repo-local. Do not store secrets in it. Captures include git status, diff stats, recent commits, durable notes, and a human-authored task note, but not raw diffs by default.

## Website

The original static site lives in `site/`.

```sh
npm run start:site
```

Live site: https://toyeshhm.github.io/relayroom/

Docs: https://toyeshhm.github.io/relayroom/docs.html

## License

MIT
