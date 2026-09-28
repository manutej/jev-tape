# Incoming results

Drop one JSON file per source here to fold other sessions' results into the registry. `npm run brief`
merges every `*.json` in this folder, fails on a clash or a missing field, and rebuilds the page.

```json
{
  "experiments": [
    { "id": "E13", "title": "…", "kind": "lab | live | proxy", "n": 12, "date": "2026-09-29", "jev": "jev-1.13.0", "model": "…",
      "what": "what was run, in one line", "result": "the number with its n and baseline", "stamp": "⚖", "stampWord": "measured",
      "file": "repo path/of/the/results.json" }
  ],
  "rows": [
    { "exp": "E13", "id": "unique-within-the-experiment", "task": "what the row asked", "site": "host", "url": "https://…",
      "claim": "the claim or target", "expect": "passed | failed | none | label=value", "kind": "html | gate | verify | login | pick | pdf | …",
      "jev": "passed | failed | escalate | stopped | none | <answer text>", "jevP": 0.97, "jevMs": 248, "jevOk": true,
      "model": "passed", "modelMs": 41000, "modelOk": true, "sonnet": "passed", "sonnetMs": 2800, "sonnetOk": true,
      "note": "anything a reader needs", "file": "repo path/of/the/results.json" }
  ]
}
```

Rules. Experiment ids are `E<number>`, unique across the registry (the next free one is in `results/registry.json`).
Stamps are one of `⚖ ✓ ± ? ⊘ ◐ ◆` with a word. `jevOk` is `true` or `false` only when a label exists, else omit it.
Times are milliseconds. Every row and every experiment names the committed file its numbers come from; a
number without a file does not go in. Do not edit `results/registry.json` by hand; it is rebuilt.
