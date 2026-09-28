# Vibium fixtures

Recorded 2026-09-28 with `vibium v26.8.21` (HermeticOrmus/vibium `feat/linear-tasks`, Chrome for Testing 152) against
two public demo sites. Each `*.json` is one `snapshot()`: `url`, `title`, `text`, `map`.

| file | page |
| --- | --- |
| `login-page.json` | the-internet.herokuapp.com/login, untouched |
| `login-fail.json` | same page after a wrong password: flash "Your password is invalid!" |
| `login-success.json` | /secure after the right password: flash "You logged into a secure area!", Logout link |
| `after-logout.json` | /secure after clicking the flash close (×), not Logout: same page, flash still in text |
| `example-home.json` | example.com |
| `example-after.json` | iana.org after clicking Learn more |
| `login-success.positional-diff.json` | raw `vibium diff map` for the login: shows why the diff is computed in code |
| `checkout.json` | hand-written shape for the C10 twin; not a recording |
| `bad-pack.json` | a pack that must fail `loadPack` |
| `fake-vibium.mjs` | stand-in binary for `npm test`; answers `--json` calls from a scenario |

The demo site prints its own test username and password in the page text. They are the site's published
demo values, not credentials of ours. No other secrets. No client data.
