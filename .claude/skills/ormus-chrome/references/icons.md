# Gold line icons

Line drawings, never filled: stroke `ormus-gold`, 1.5px, round caps and joins, on a 24-unit grid. They sit
beside a `mono-label` or a card title at 28px, in chips at 16px, in table headers at 20px. Define the set
once as `<symbol>`s in a hidden SVG at the top of the page and place each with `<use href="#i-name"/>`.
One icon per idea, no icon inside a button label, no emoji anywhere.

```css
.ic { width: 28px; height: 28px; stroke: var(--ormus-gold); fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.ic--sm { width: 20px; height: 20px; }
```

The set used on the Vibium brief (classify, gate, verify, tape, park, model, person, page, clock, replay,
camera, cursor, search, lab, live):

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-classify" viewBox="0 0 24 24"><circle cx="12" cy="4" r="1.6"/><path d="M12 6v4M12 10l-6 6M12 10l6 6M6 16v4M18 16v4"/></symbol>
  <symbol id="i-gate" viewBox="0 0 24 24"><path d="M4 20V6M2 20h6M4 10h12"/><circle cx="18.5" cy="10" r="2.2"/><path d="M4 6l2-2"/></symbol>
  <symbol id="i-verify" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></symbol>
  <symbol id="i-tape" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="7.5" cy="12" r="2.6"/><circle cx="16.5" cy="12" r="2.6"/><path d="M7.5 9.4h9M7.5 14.6h9"/></symbol>
  <symbol id="i-park" viewBox="0 0 24 24"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M10 9v6M14 9v6"/></symbol>
  <symbol id="i-model" viewBox="0 0 24 24"><path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/></symbol>
  <symbol id="i-person" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></symbol>
  <symbol id="i-page" viewBox="0 0 24 24"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="i-replay" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></symbol>
  <symbol id="i-camera" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/></symbol>
  <symbol id="i-cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-2 6z"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></symbol>
  <symbol id="i-lab" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-6 10a1.5 1.5 0 0 0 1.3 2.2h13.4A1.5 1.5 0 0 0 20 19L14 9V3"/><path d="M7 15h10"/></symbol>
  <symbol id="i-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/></symbol>
</svg>
```

Draw a new one the same way: a few strokes on the 24 grid, a circle or two, nothing that needs a fill.
