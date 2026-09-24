# Local Grok + MCP

Use this file as the system note when you open this repo in a **local** Grok session that already has Gmail and GitHub connectors.

## Secrets

- TypeSafe key: `TYPESAFE_API_KEY` in `.env` on this machine only.
- Gmail / GitHub: the MCP connectors Grok already has. Do not copy those tokens into this repo.
- Never print `TYPESAFE_API_KEY` or `Authorization` headers into the chat transcript.

## First session

```
You are working in manutej/jev-tape.
Pin jev-1.13.0.
Do not send mail. Do not push or merge.
Read Gmail with gmail_search / gmail_get_message.
Read GitHub with list_commits / search / get_file.
Write a fixture under fixtures/ and run: npm run qualify -- fixtures/<file>.json
Paste back verdict + response.model + answers only.
```

## After qualify

| Verdict | Your next move |
| --- | --- |
| RED | stop |
| AMBER | park |
| GREEN + C10-shaped (client, money, default-branch merge) | park anyway |
| GREEN + short teammate reply | you may send by hand; the script will not |

TypeSafe answers questions. MCP executes tools. Do not fuse them in one turn.
