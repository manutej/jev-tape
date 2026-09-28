# Charts in the Ormus chrome

Canvas, SVG and WebGL cannot read CSS variables: take values from `tokens.json`, never pasted hex.

## Encoding

- Background `ormus-deep`. Series by intensity only: `ormus-gold` for the primary class (the thing
  the page argues for), then `ormus-ink`, `ormus-ink-muted`, `ormus-muted`. Past four classes,
  encode with size, shape or grouping. Emphasis is `ormus-gold-bright`, never a new hue.
- This palette fails a chroma-floor check by design (ink and ink-muted read as grey), so identity
  must never rest on color alone: every mark carries a direct label, and rows are named at the left.
- Axes and grid are hairlines (`ormus-hairline`, `canvas-edge-default`). Ticks and small labels in
  JetBrains Mono, row labels in Inter, values in JetBrains Mono 500. Never the serif below 15px.
- Text wears text tokens (`ormus-ink`, `ormus-ink-muted`); a value printed inside a light bar wears
  `ormus-deep`.
- One axis per chart. Never dual axes, never a rainbow, never a hue at a diverging midpoint.
- Hover: a transparent hit rectangle wider than the mark with a `<title>` tooltip; the mark under
  hover goes `ormus-gold-bright`.

## The contrast bar (when the point is "how much faster")

Put all series on one linear scale so the eye sees the ratio. The small value becomes a thin gold
mark at the left edge (minimum 3px so it stays visible) and the caption says so. Beside each bar
print the value in mono and the ratio to the gold series in Cormorant Garamond at 15px in gold:
"1×", "11× slower", "164×". Do not use a log scale to make the small bar look bigger; if a log
scale is the only readable form, say "log scale" in the figure head and use dots, not bars.

```html
<svg viewBox="0 0 640 176" role="img" aria-label="…">
  <line class="ax" x1="210" y1="150" x2="620" y2="150"/>
  <text class="tick" x="210" y="167" text-anchor="middle">0</text>
  …
  <text class="rowlab" x="0" y="38">Jev, typed judge</text>
  <text class="rowsub" x="0" y="54">jev-1.13.0</text>
  <rect class="hit" x="210" y="22" width="410" height="34"><title>248 ms median, 8 pages</title></rect>
  <rect class="bar m-gold" x="210" y="26" width="3" height="26"/>
  <text class="val val-gold" x="221" y="44">0.25 s</text>
  <text class="ratio-one" x="286" y="44">1×</text>
</svg>
```

Classes (see `page-template.html`): `.ax`, `.tick`, `.rowlab`, `.rowsub`, `.val`, `.val-gold`,
`.ratio`, `.ratio-one`, `.bar`, `.m-gold`, `.m-ink`, `.m-muted`, `.hit`.

## Stat tiles

A `fusion-card` with a `mono-label`, the number in Cormorant Garamond light at 3rem with the unit
small and muted, and one sentence of context in `ormus-ink-muted`. Use tiles only when those figures
are the point of the page, and give every number its n and baseline nearby.

## Status and audit views

An audit or risk matrix may keep a restrained red/amber/green trio scoped to that one view, each
state also named by a word. Nowhere else.
