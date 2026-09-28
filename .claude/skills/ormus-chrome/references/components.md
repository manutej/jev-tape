# Components

Six CSS classes, no JavaScript framework. Load `tokens.css` then `fusion.css`; the three webfonts come from Google Fonts (Cormorant Garamond 300/400, Inter 400/500/600, JetBrains Mono 400/500).

# Surface

The app shell: `.surface-firm` paints the fixed midnight lacquer, the gold bloom and the drifting gold dust, and sets the serif on h1 to h3.

- Put it once, on the outermost app element. Every page shares the material.
- The consumer supplies the content and loads the three webfonts.
- Headings inside it get Cormorant Garamond automatically; `h1` goes light 300.
- Print strips the texture and dust and neutralizes to white.
- Do not stack a second texture or a blur on top of it.

Preview markup (styled by `fusion.css`):

```html
<main class="surface-firm">
  <span class="mono-label">Software firm · Worldwide</span>
  <h1>Digital systems and tools, cast in liquid gold.</h1>
  <p>Closing the Gap between Executive Intent and Technology.</p>
</main>
```

---

# MonoLabel

The lab-log micro-label: `.mono-label` sets JetBrains Mono at 0.72rem, 0.08em tracking, uppercase, `ormus-ink-muted`, and prefixes "/ ". `.mono-label--gold` raises it to `ormus-gold`.

- Use above titles, on card heads, for metadata and slide section tags.
- The consumer supplies plain text; the "/ " prefix is added by CSS, so do not type it.
- Gold only for the one label that leads a surface.

Preview markup (styled by `fusion.css`):

```html
<div class="row">
  <span class="mono-label">Services</span>
  <span class="mono-label mono-label--gold">Graph layer</span>
  <span class="mono-label">HQ Panama City</span>
</div>
```

---

# Card

A panel on a whisper of surface with a gold top hairline: `.fusion-card`. It lifts 2px on hover.

- Use for fleet entries, services, case studies: one card, one subject.
- The consumer supplies a `mono-label`, an `h3` and a short paragraph. A mono product name is the identity; no icon needed.
- Saturn or flame may decorate a services card, cycled. Never the swan.
- Padding is `card-padding`, corner `ormus-radius`. Do not add shadows or a colored side border.

Preview markup (styled by `fusion.css`):

```html
<div class="row">
  <article class="fusion-card"><span class="mono-label mono-label--gold">liquid-gold</span><h3>Open-source kits</h3><p>Confidence-gated routing and triage for agent pipelines.</p></article>
  <article class="fusion-card"><span class="mono-label">ormus-brand</span><h3>Brand source</h3><p>Style guide, tokens and the canonical marks.</p></article>
</div>
```

---

# Button

Two buttons, one loud and one quiet: `.fusion-btn` with `--primary` (gold fill, `ormus-on-gold` text) or `--ghost` (hairline border that turns gold on hover).

- One primary per surface. Everything else is ghost.
- The consumer supplies a `<button>` or `<a>` and a sentence-case label: "Send a message", "Book a call", "See the work".
- Padding `button-padding-y` by `button-padding-x`, corner `ormus-radius`, weight 500.
- No pills, no icons inside labels, no exclamation marks.

Preview markup (styled by `fusion.css`):

```html
<div class="row">
  <a class="fusion-btn fusion-btn--primary" href="#">Send a message</a>
  <a class="fusion-btn fusion-btn--ghost" href="#">Book a call</a>
  <a class="fusion-btn fusion-btn--ghost" href="#">See the work</a>
</div>
```

---

# Lacquer

Lacquer panels: `.lacquer` paints the midnight lacquer texture opaque; `.lacquer-glass` lays it at `lacquer-glass-opacity` under content.

- Use `.lacquer` for opaque chrome (a header, an ending screen) and `.lacquer-glass` for panels over live video.
- The consumer supplies the panel content and its padding.
- Never full alpha over video, never `backdrop-filter: blur`.

Preview markup (styled by `fusion.css`):

```html
<div class="row">
  <div class="panel lacquer"><span class="mono-label">lacquer</span><p>Opaque chrome.</p></div>
  <div class="glass-ground"><div class="panel lacquer-glass"><span class="mono-label">lacquer-glass</span><p>Over live footage.</p></div></div>
</div>
```

---

# Reveal

The film-frame cut-in: `.fusion-reveal` hides content behind a clip-path inset and a `reveal-rise` offset; adding `.is-revealed` cuts it in over 1.1s on the expo-out curve.

- The consumer adds `.is-revealed` from an IntersectionObserver when the element enters view.
- The hidden state only applies under `@media (scripting: enabled)`: without script, content stays visible.
- Reduced motion shows content at once, with no transition.
- One orchestrated reveal per section. Do not stagger every line.

Preview markup (styled by `fusion.css`):

```html
<div class="wrap">
  <h2 id="r" class="fusion-reveal is-revealed">Few things, done properly.</h2>
  <button class="fusion-btn fusion-btn--ghost" id="replay" type="button">Replay</button>
</div>
<script>
  var r = document.getElementById('r');
  document.getElementById('replay').addEventListener('click', function () {
    r.classList.remove('is-revealed');
    requestAnimationFrame(function () { requestAnimationFrame(function () { r.classList.add('is-revealed'); }); });
  });
</script>
```
