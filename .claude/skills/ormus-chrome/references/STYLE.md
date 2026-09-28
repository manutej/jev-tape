Digital systems and tools, cast in liquid gold. A midnight lacquer surface, gold as the single accent, serif display type over engineering mono. Boutique, adult, quiet. The register is a lab log written by a firm that knows what it is doing.

## Content fundamentals

- Write plain, confident sentences. Lead with the answer.
- No em dashes in visible copy, HTML entities included.
- No "X, not Y" constructions, no aphorism-speak, no sales-speak.
- One quiet call to action per surface, in sentence case: "Start a conversation", "Send a message", "Book a call", "See the work".
- No emojis anywhere in product UI.
- The firm is a "Software Firm · Worldwide", HQ Panama City. Lead with building; AI is one part of the work.
- Real copy to model: "Digital systems and tools, cast in liquid gold." · "Few things, done properly." · "Executive intent, technology you own." · "Closing the Gap between Executive Intent and Technology".

## Color

- Paint surfaces `ormus-midnight`; use `ormus-deep` for the page ground and any panel that must be opaque.
- `ormus-gold` is the only accent. One gold voice per surface: the primary button, the active item, the one leading label. Hover and active states go to `ormus-gold-bright`.
- Set text in `ormus-ink`, secondary text in `ormus-ink-muted`, the quietest metadata in `ormus-muted` (24px and up only).
- State and class read through intensity (`ormus-gold`, `ormus-ink`, `ormus-ink-muted`, `ormus-muted`). No green, no rainbow badges, no traffic lights.
- `ormus-danger` is for errors only, always with a word or icon.
- An audit or risk matrix may keep a restrained red/amber/green trio, scoped to that one view.
- Borders are `ormus-hairline`. Text on a gold fill is `ormus-on-gold`.
- There is no light mode. Midnight is pinned. Print neutralizes to white paper with `print-gold` for gold and near-black ink.

## Type

- Display: Cormorant Garamond (`h1`, `h2`, `h3`). `h1` is light 300 with -0.01em tracking; `h2` and `h3` are 400. Never bold the serif.
- Body: Inter (`body`, `button`).
- Micro-labels and metadata: JetBrains Mono (`mono-label`), 0.72rem, 0.08em tracking, uppercase, prefixed with "/ ".
- Cormorant runs optically small: bump serif headings one step over their sans equivalents.
- All three faces are Google Fonts. Load Cormorant Garamond 300/400, Inter 400/500/600 and JetBrains Mono 400/500 yourself; without the display face, headings fall back to Georgia.

## Material

- One texture: `midnight-lacquer.jpg` (Texture group), painted on a `position: fixed` layer behind `.surface-firm` so it never scrolls and tiling never reads as patches. A faint gold bloom anchors the top right.
- Gold dust: a field of specks drifting on a 60s transform-only loop, stilled under reduced motion.
- Panels over live video are solid `ormus-deep` at about 90%, or `.lacquer-glass` at `lacquer-glass-opacity`. Never `backdrop-filter: blur`.
- AI-made textures must be high-pass flattened before tiling (subtract a GaussianBlur(96) low-pass over a uniform base, wrap-blend the seams).

## Shape and layout

- One corner radius: `ormus-radius` (3px). No pills, no large rounding.
- Cards carry a gold top hairline (`card-hairline-gold`) and lift 2px on hover. Padding `card-padding`.
- Buttons: gold fill for the one primary action, hairline ghost for the rest. Padding `button-padding-y` by `button-padding-x`.
- No shadows. Separation comes from hairlines and intensity.
- Generous negative space; one idea per screen.

## Motion

- One curve: `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out).
- Reveals are film-frame cut-ins: clip-path inset plus a `reveal-rise` lift over 1.1s. Gate the hidden initial state behind `@media (scripting: enabled)` so no-JS clients and crawlers always see content.
- Card lift 0.2s, button color 0.15s.
- Everything honors `prefers-reduced-motion`.
- Scroll-scrubbed video uses a 4-frame GOP (`-g 4 -keyint_min 4 -sc_threshold 0`), scrubs forward only, and never writes `currentTime` while seeking.

## Marks and sigils

- The flat gold mark (Logos: `ormus-mark-gold-1024/512/128.png`) is for UI, favicons, avatars and small sizes. The liquid-gold mark is for heroes and covers. Scale down, never up. There is no vector master.
- The kintsugi mark (`kintsugi-mark.png`) is the resolution mark: endings, sign-offs, closing slides.
- The swan lives only in the marks and the hero footage. Never draw it as line art.
- Saturn and flame are the only sigils that decorate cards. Swan renders are avatars. Ouroboros, caduceus and compass are lore forms for their own contexts.
- Fleet and product cards carry a mono name, no icon.
- The logo reads as a golden swan swimming on Saturn toward a fire: structure carried into passion.

## Graphs, charts and canvas

- Canvas and WebGL cannot read CSS variables: import `tokens.json` and use these tokens, never pasted hex.
- Background `ormus-deep`. Nodes by intensity only: `ormus-gold` for the primary class, then `ormus-ink`, `ormus-ink-muted`, `ormus-muted`. Past four classes, encode with size, shape or grouping.
- Edges are hairlines: `canvas-edge-default` at rest, `canvas-edge-gold` and `canvas-edge-gold-soft` for the relation being shown, `canvas-edge-muted` for context. Node outline `canvas-node-border`.
- Labels in Inter or JetBrains Mono, `ormus-ink`. Never the serif at small sizes on canvas.
- Emphasis is `ormus-gold-bright`, never a new hue. Layout settling and pulses use the reveal curve and stop under reduced motion.

## Decks and documents

- Slide ground is `ormus-midnight` or the lacquer texture. One gold accent per slide.
- Titles in Cormorant Garamond light, body in Inter, slide numbers and section tags as `mono-label` ("/ 03 · graph layer").
- Open on the gold mark or the hero poster (Footage group); close on the kintsugi mark.
- Printed and PDF pages follow the print rule: white paper, `print-gold`, near-black ink.

## Not synced

- The legacy `--ormus-copper`, `--ormus-teal` and pre-fusion aliases in tokens.css are engine compatibility only, not brand. Left out.
- The gold-dust box-shadow field and the bloom gradient are in `components/bundle.css`, not tokens.
- Three GLB meshes (swan, Saturn, flame) stay in the repository; this system does not take 3D files.
- No component bundle: the fusion layer is CSS classes, so previews are static markup styled by `bundle.css`.
