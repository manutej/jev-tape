# Local Grok Build + MCP

Open this repo in **Grok Build** (`grok` CLI / TUI) on your machine. That session already has the filesystem and, if you connected them, Gmail and GitHub MCP.

This web chat cannot invoke Grok Build. The key stays on your machine.

## Secrets

- TypeSafe key: `TYPESAFE_API_KEY` in `.env` at the repo root. Gitignored.
- Gmail / GitHub: Grok Build MCP connectors. Do not copy those tokens into this repo.
- Never print `TYPESAFE_API_KEY` or `Authorization` headers into the transcript.

## First session in Grok Build

```
You are working in manutej/jev-tape.
Pin jev-1.13.0.
Do not send mail. Do not push or merge unless I say so.
Read Gmail with gmail_search / gmail_get_message.
Read GitHub with list_commits / search / get_file.
Write a fixture under fixtures/ and run: npm run qualify -- fixtures/<file>.json
Paste back verdict + response.model + answers only.
```

If `src/` or `scripts/` are missing after `git pull`, tell Grok Build to pull origin and stop. Do not reconstruct v1 from HTML.

## After qualify

| Verdict | Next move |
| --- | --- |
| RED | stop |
| AMBER | park |
| GREEN + C10 action (Complete, Trash, ResolveWaiting, send, merge-to-default) | park for a named human, whatever the audience |
| GREEN + draft | save the draft; the script will not send |

The verdict is computed in code (`src/surface-gate.ts`, jev-core `gate()`), not chosen by Jev. Its θ is smoke-only, so it never applies a write. Contract: `.jev/README.md`.

TypeSafe answers questions. MCP executes tools. Do not fuse them in one turn.
