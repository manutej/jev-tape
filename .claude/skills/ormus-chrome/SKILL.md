---
name: ormus-chrome
description: Present an HTML page, brief, dashboard, chart or deck in the Ormus design chrome (Ormus Fusion: midnight lacquer ground, one gold accent, Cormorant Garamond display over Inter body and JetBrains Mono labels, hairlines instead of shadows, a 3px radius). Use when asked for "Ormus chrome", "Ormus style", "the Ormus design system", "liquid gold", "midnight lacquer", or when a page for the Ormus firm, the Vibium team, leadership or a client should carry the house look. One option among others for presenting HTML in this repo; not a default for every page.
---

# Ormus chrome

The Ormus design system as a skill: the tokens, the component layer, the brand rules and a page
template, so a page in this repo can wear the house look without reaching for the design artifact.
Source of truth: Design System artifact "Ormus Fusion", synced from `Ormus-Solutions/ormus-brand`
`main@1f78935` on 2026-09-28 (artifact `claude.ai/code/artifact/d514c720-4d77-48e3-b54d-753e1d0c8936`).
When the brand repo changes, re-vendor `references/tokens.*` and `references/fusion.css` from it.

## When to use, when not

Use for a brief, a handoff, a results page, a dashboard, a deck, a chart, or any page that should read
as the firm's own. `docs/vibium-team-brief.html` is the worked example. Do not use for a repo README,
a spec, a test fixture, or a page a third party will restyle. It is one option; the artifact-design
skill's fundamentals still apply underneath it (responsive, complete at rest, real content).

## The rules in one screen

Color. Ground `ormus-deep` (#0e1830), surfaces `ormus-midnight` (#14213d). `ormus-gold` (#d29e3d) is
the only accent: one gold voice per surface (the primary button, the active item, the one leading
label, the primary chart series). Hover goes to `ormus-gold-bright`. Text `ormus-ink`, secondary
`ormus-ink-muted`, quietest metadata `ormus-muted` at 24px and up only. Borders `ormus-hairline`.
Errors only in `ormus-danger`, always with a word. No green, no traffic lights, no second accent.
There is no light mode: pin midnight, set `color-scheme: dark`, and let print neutralize to white
paper with `print-gold`.

Type. `h1`–`h3` in Cormorant Garamond, never bold; `h1` light 300 with -0.01em tracking. Body and
buttons in Inter. Micro-labels in JetBrains Mono at 0.72rem, 0.08em tracking, uppercase, prefixed
by CSS with "/ " (`.mono-label`; `.mono-label--gold` for the one that leads). Load all three from
Google Fonts with real fallbacks (Georgia, system sans, Consolas).

Material. One texture, the midnight lacquer, on a fixed layer behind `.surface-firm`, with a faint
gold bloom at the top right and drifting gold dust on a 60s transform-only loop, stilled under
reduced motion. Without the texture file, draw the surface from the tokens (a midnight-to-deep
gradient with an SVG turbulence grain tinted gold at 7% alpha), as the template does. Never
`backdrop-filter: blur`, never a second texture.

Shape. One radius, 3px. Cards on a whisper of surface with a gold top hairline, lifting 2px on hover.
Buttons: one gold primary, the rest hairline ghosts, sentence case. No shadows, no pills, no emojis.

Motion. One curve, `cubic-bezier(0.16, 1, 0.3, 1)`. One reveal per section: clip-path cut-in plus a
56px rise over 1.1s, hidden state gated behind `@media (scripting: enabled)` so the page is complete
at rest. Card lift 0.2s, button color 0.15s. Everything honors `prefers-reduced-motion`.

Copy. Plain, confident sentences that lead with the answer. No em dashes, no "X, not Y", no
aphorisms, no sales-speak. One quiet call to action per surface: "See the work", "Book a call".

Marks. The flat gold mark for UI, the liquid-gold mark for heroes, the kintsugi mark for endings.
Never redraw the swan as line art; if the mark files are not at hand, leave marks out.

## Procedure

1. Copy `references/page-template.html` and keep its `:root` tokens, surface, type, card, button,
   table and print rules. Put a `<title>` of two to four words at the top.
2. Masthead: a gold `mono-label` for the audience or date, an `h1`, a serif lede in `ormus-ink-muted`,
   and on wide screens the cover block art from `references/cover.md`.
3. Sections: `mono-label` eyebrow, `h2`, one paragraph, then the content. Tiles only when the numbers
   are the point. Tables inside an `overflow-x: auto` box with mono uppercase headers.
4. Charts: follow `references/charts.md`. Series by intensity (gold, ink, ink-muted, muted), one
   linear scale when the point is contrast, a direct label and a ratio on every mark.
5. Research pages: state the record first (how many experiments, calls, rows, pages), show example
   tasks as chips that open the row, and carry the notebook stamp grammar on every verdict, as a
   glyph with a word (⚖ measured · ✓ accept · ± refine · ? speculative · ⊘ gate · ◐ partial · ◆ law).
   Sections may follow the arc Laws → Observed → Prospects → Assay → Yield. A searchable table of
   every encoded row belongs at the end, with the data inlined as JSON in the page.
6. Close on a gold rule and a mono sign-off line; decks close on the kintsugi mark.
7. Check the page at phone width, in print, and with reduced motion, then publish or commit under
   `docs/`.

## References

| File | What it holds |
| --- | --- |
| `references/STYLE.md` | The brand book, verbatim: content, color, type, material, shape, motion, marks, charts, decks |
| `references/tokens.json` | Every token with value and usage, for canvas, charts, slides and scripts |
| `references/tokens.css` | The same tokens as CSS custom properties (raw palette, semantic roles, fonts, curve, radius) |
| `references/fusion.css` | The component layer: `.surface-firm`, `.mono-label`, `.lacquer`, `.fusion-card`, `.fusion-btn`, `.fusion-reveal`, print |
| `references/components.md` | The six components with their rules and preview markup |
| `references/cover.md` | The cover block composition, with the SVG |
| `references/charts.md` | Chart rules in this chrome, with the contrast-bar pattern |
| `references/icons.md` | The gold line-icon set as SVG symbols, and how to draw more |
| `references/page-template.html` | A complete page skeleton in the chrome, self-contained |

Assets (lacquer texture, marks, sigils, banners, footage) live in the design artifact and the brand
repo `Ormus-Solutions/ormus-brand` under `assets/`, not here. `fusion.css` expects them under `assets/`
next to it. Until they are vendored, the page template draws the surface from tokens (gradient plus a
gold-tinted SVG grain) and leaves the marks out.
