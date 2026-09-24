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
| GREEN + C10-shaped (client, money, default-branch merge) | park anyway |
| GREEN + short teammate reply | you may send by hand; the script will not |

TypeSafe answers questions. MCP executes tools. Do not fuse them in one turn.
