# Cover composition

The cover is block art, not illustration: one tall gold slab bled off the top (the single accent, the largest block), a gold-bright satellite (the hover tint), an ink block bleeding off an edge, and an ink-muted satellite. Bottoms sit on one line, gutters in `card-padding` (24px) multiples, four `ormus-hairline` rules cross the blocks at a 48px pitch, corners at `ormus-radius` (3px). Words sit at the bottom left in Cormorant Garamond light with a muted tagline in Inter.

Use it for page mastheads, deck openers and social cards. Keep the proportions; change the words.

```html
<svg viewBox="0 0 480 320" width="480" height="320">
<!--
  blocks      ormus-gold 192x288 slab bled off the top (the one accent, largest) · ormus-gold-bright 96x144 (the hover tint) · ormus-ink 144x72 bleeding off the right edge · ormus-ink-muted 48x24 satellite, about 26% of 960x320
  arrangement one tall gold slab with satellites, bottoms on one line two card-padding steps above the edge, card-padding gutters
  pattern     hairlines, from "Separation comes from hairlines and intensity": four ormus-hairline rules at a 2x card-padding pitch crossing the blocks
  scales      sides and gutters in card-padding (24px) multiples; pitch 48px; corners ormus-radius (3px)
-->
<rect class="gold blk" x="24" y="-16" width="192" height="288" rx="3"/>
<rect class="muted blk" x="240" y="96" width="48" height="24" rx="3"/>
<rect class="bright blk" x="240" y="128" width="96" height="144" rx="3"/>
<rect class="ink blk" x="360" y="200" width="144" height="72" rx="3"/>
<line class="rule" x1="0" y1="80" x2="480" y2="80"/>
<line class="rule" x1="0" y1="128" x2="480" y2="128"/>
<line class="rule" x1="0" y1="176" x2="480" y2="176"/>
<line class="rule" x1="0" y1="224" x2="480" y2="224"/>
</svg>
```

CSS classes used above: `.gold { fill: var(--ormus-gold) }`, `.bright { fill: var(--ormus-gold-bright) }`, `.ink { fill: var(--ormus-ink) }`, `.muted { fill: var(--ormus-ink-muted) }`, `.rule { stroke: var(--ormus-hairline); stroke-width: 1 }`.
