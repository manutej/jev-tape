/* jev demos — shared runtime.
   Tape  : the recorder pinned at the bottom of every demo (an Event History twin).
   Twin  : a deterministic stand-in for TypeSafe System One. Same wire shape, same contract
           checks as src/typesafe/contract.ts, NO network. It never claims to be a live call.
   compose: composeAnswers is code (wiki/pages/compose-answers.md). Dual axis (wiki/pages/dual-axis.md).
*/
(function () {
  const D = (window.JEV_DATA = window.JEV_DATA || {});
  const PIN = "jev-1.13.0";

  /* ---------- Tape ---------- */
  class Tape {
    constructor(opts = {}) {
      this.title = opts.title || "Event History";
      this.events = [];
      this.posts = 0; this.replayed = 0; this.activities = 0;
      this.mount();
    }
    mount() {
      const dock = document.createElement("div");
      dock.className = "tape-dock"; dock.setAttribute("role", "region"); dock.setAttribute("aria-label", "Tape: event history");
      dock.innerHTML = `<div class="inner">
        <div class="head"><div><b>${this.title}</b><span>queue jev-tape · pin ${PIN}</span></div>
          <div class="ctr">POSTs <i data-c="posts">0</i> · activities <i data-c="acts">0</i> · replayed <i data-c="rep">0</i></div></div>
        <div class="tape"><div class="strip"></div><div class="empty">nothing recorded yet — the tape is blank until an Activity completes</div><div class="playhead"></div></div></div>`;
      document.body.appendChild(dock);
      this.strip = dock.querySelector(".strip"); this.emptyEl = dock.querySelector(".empty");
      this.ctr = { posts: dock.querySelector('[data-c=posts]'), acts: dock.querySelector('[data-c=acts]'), rep: dock.querySelector('[data-c=rep]') };
      this.tapeEl = dock.querySelector(".tape");
      window.addEventListener("resize", () => this.scroll());
    }
    /** record({kind, label, verdict, post}) — kind: activity|gate|signal|apply|crash|replay|human|code */
    record(ev) {
      const e = { t: this.events.length + 1, kind: ev.kind || "activity", label: ev.label || "", verdict: ev.verdict || "", post: !!ev.post, replay: !!ev.replay, detail: ev.detail || "" };
      this.events.push(e);
      if (e.post) this.posts++;
      if (e.kind === "activity" && !e.replay) this.activities++;
      if (e.replay) this.replayed++;
      const c = document.createElement("div");
      c.className = `cell ${e.kind} ${e.verdict} ${e.post ? "post" : ""} ${e.replay ? "replay" : ""}`;
      c.title = e.detail || `${e.kind} ${e.label} ${e.verdict}`;
      c.innerHTML = `<span class="k">${String(e.t).padStart(3, "0")} ${e.replay ? "replay" : e.kind}${e.post ? " · POST" : ""}</span><span class="l">${esc(e.label)}</span><span class="v">${esc(e.verdict || e.detail || "")}</span>`;
      this.strip.appendChild(c); this.emptyEl.style.display = "none";
      this.sync(); this.scroll();
      return e;
    }
    crash(label = "worker crashed") { return this.record({ kind: "crash", label, verdict: "process lost" }); }
    /** replay() re-emits every completed Activity result from history without a POST. */
    replay() {
      const done = this.events.filter(e => e.kind === "activity" && !e.replay);
      this.record({ kind: "replay", label: "replay begins", verdict: `${done.length} activities on tape` });
      for (const e of done) this.record({ kind: "activity", label: e.label, verdict: e.verdict, post: false, replay: true, detail: "reused from Event History — no POST" });
      return done.length;
    }
    clear() { this.events = []; this.posts = this.replayed = this.activities = 0; this.strip.innerHTML = ""; this.strip.style.transform = ""; this.emptyEl.style.display = ""; this.sync(); }
    sync() {
      this.ctr.posts.textContent = this.posts; this.ctr.acts.textContent = this.activities; this.ctr.rep.textContent = this.replayed;
      this.ctr.posts.classList.toggle("zero", this.posts === 0);
    }
    scroll() {
      const w = this.tapeEl.clientWidth, sw = this.strip.scrollWidth;
      this.strip.style.transform = sw > w - 20 ? `translateX(${(w - 20) - sw}px)` : "";
    }
  }

  /* ---------- Twin judge ---------- */
  const NOUL_MID = [0.4, 0.6];
  function validateRequest(req) {
    const ids = Object.keys(req.questions || {});
    if (!ids.length) return { kind: "empty-questions", message: "questions map is empty" };
    if (req.model !== PIN) return { kind: "wrong-model", message: `model must be ${PIN}, got ${req.model}` };
    for (const id of ids) {
      const q = req.questions[id];
      if (q.type === "score") { const n = (q.criteria || []).length; if (n < 2 || n > 10) return { kind: "score-level-count", id, message: `${id}: Score needs 2-10 labeled levels` }; }
      if (q.type === "choice") { const k = Object.keys(q.criteria || {}); if (k.length < 2) return { kind: "choice-criteria", id, message: `${id}: Choice needs ≥2 criteria` }; }
    }
    return null;
  }
  /** twin.systemOne(req, resolvers) — resolvers[id](state) → number | {choice, probabilities} | {score, probabilities}.
      Deterministic. Returns the SystemOneResponse shape. Marks itself as a twin. */
  const twin = {
    pin: PIN,
    systemOne(req, resolvers) {
      const bad = validateRequest(req); if (bad) throw new Error(`422 ${bad.message}`);
      const key = reqKey(req);
      (window.__jevRequests = window.__jevRequests || []).push({ key, req });   // read by demos/record.mjs
      const rec = (D.recorded && D.recorded.answers && D.recorded.answers[key]) || null;
      if (rec) { markRecorded(rec); return { model: rec.model, answers: rec.answers, usage: rec.usage, twin: false, recorded: true, recordedAt: rec.at }; }
      const answers = {};
      for (const [id, q] of Object.entries(req.questions)) {
        const r = resolvers[id]; if (!r) throw new Error(`twin: no resolver for ${id}`);
        const out = r(req.state, q);
        if (q.type === "noul") answers[id] = { type: "noul", noul: clamp(+out, 0, 1) };
        else if (q.type === "choice") {
          const probs = out.probabilities || softmaxFor(Object.keys(q.criteria), out.choice);
          answers[id] = { type: "choice", choice: out.choice, probabilities: probs, confidence: out.confidence ?? Math.max(...Object.values(probs)) };
        } else {
          const levels = q.criteria.length; const probs = out.probabilities || softmaxFor(q.criteria.map((_, i) => String(i)), String(out.score));
          answers[id] = { type: "score", score: out.score, legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), c])), probabilities: probs, confidence: out.confidence ?? Math.max(...Object.values(probs)), levels };
        }
      }
      const usage = { input_tokens: Math.round(JSON.stringify(req.state).length / 3.6) + 40 * Object.keys(req.questions).length, output_tokens: 12 * Object.keys(req.questions).length };
      return { model: PIN, answers, usage, twin: true };
    },
    validateRequest, reqKey,
  };
  /** stable key for a request: the same state + questions always map to the same recorded answer map */
  function stableStr(v) { if (Array.isArray(v)) return "[" + v.map(stableStr).join(",") + "]"; if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stableStr(v[k])).join(",") + "}"; return JSON.stringify(v); }
  function reqKey(req) { const s = stableStr({ model: req.model, state: req.state, questions: req.questions }); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0") + "-" + s.length; }
  function markRecorded(rec) { const pill = document.querySelector(".topbar .pin"); if (pill) { pill.textContent = `recorded TypeSafe answers · ${String(rec.at).slice(0, 10)} · model ${rec.model}`; pill.style.borderColor = "var(--green)"; pill.style.color = "var(--green)"; } }
  function softmaxFor(keys, pick, peak = 0.86) { const o = {}; const rest = (1 - peak) / Math.max(1, keys.length - 1); for (const k of keys) o[k] = k === pick ? peak : rest; return o; }

  /* ---------- composeAnswers (code) ---------- */
  /** compose(answers, policy) → {verdict:'GREEN'|'AMBER'|'RED', reasons[]} — dual axis:
      theta = P(fail-closed gate is GREEN) ; floor = pack peakedness (top_prob_floor). Never the same number. */
  function compose(answers, policy = {}) {
    const theta = policy.theta ?? 0.7, floor = policy.floor ?? 0.6, localRed = policy.localRed || [];
    const reasons = []; let verdict = "GREEN";
    if (localRed.length) { verdict = "RED"; reasons.push(`local RED: ${localRed.join("; ")} (judge Choice cannot override a local RED)`); }
    for (const [id, a] of Object.entries(answers)) {
      if (a.type === "noul") {
        if (a.noul > NOUL_MID[0] && a.noul < NOUL_MID[1]) { if (verdict === "GREEN") verdict = "AMBER"; reasons.push(`${id}: noul ${a.noul.toFixed(2)} sits in the mid-band (${NOUL_MID[0]}–${NOUL_MID[1]}) → review`); }
        else if (a.noul <= NOUL_MID[0] && policy.noulGate?.includes(id)) { verdict = "RED"; reasons.push(`${id}: noul ${a.noul.toFixed(2)} fails the gate`); }
      }
      if (a.type === "choice") {
        const top = Math.max(...Object.values(a.probabilities));
        if (a.choice === "RED") { verdict = "RED"; reasons.push(`${id}: judge chose RED`); }
        else if (a.choice === "AMBER" && verdict === "GREEN") { verdict = "AMBER"; reasons.push(`${id}: judge chose AMBER`); }
        else if (a.choice === "GREEN" && (a.probabilities.GREEN ?? top) < theta) { if (verdict === "GREEN") verdict = "AMBER"; reasons.push(`${id}: P(GREEN)=${(a.probabilities.GREEN ?? top).toFixed(2)} < θ ${theta}`); }
        if (top < floor) { if (verdict === "GREEN") verdict = "AMBER"; reasons.push(`${id}: top probability ${top.toFixed(2)} < top_prob_floor ${floor} (pack not peaked)`); }
      }
    }
    if (!reasons.length) reasons.push("every axis clear");
    return { verdict, reasons };
  }

  /* ---------- small UI helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function setLamp(el, v) { el.className = `lamp ${v}`; el.textContent = v; }
  function stamp(el, v, text) { el.className = `stamp ${v} in`; el.textContent = text || v; el.offsetWidth; }
  function tick(el, to, ms = 700, fmt = (v) => Math.round(v)) {
    const from = parseFloat(el.dataset.v || "0") || 0; const t0 = performance.now();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.textContent = fmt(to); el.dataset.v = to; return; }
    (function f(now) { const p = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(f); else el.dataset.v = to; })(t0);
  }
  function segControl(root, onChange) {
    const btns = [...root.querySelectorAll("button")]; let pill = root.querySelector(".pill");
    if (!pill) { pill = document.createElement("span"); pill.className = "pill"; root.prepend(pill); }
    const place = (b) => { pill.style.width = b.offsetWidth + "px"; pill.style.transform = `translateX(${b.offsetLeft - 3}px)`; };
    btns.forEach(b => b.addEventListener("click", () => { btns.forEach(x => x.setAttribute("aria-pressed", x === b)); place(b); onChange(b.dataset.v, b); }));
    const init = btns.find(b => b.getAttribute("aria-pressed") === "true") || btns[0];
    requestAnimationFrame(() => place(init));
    return { set(v) { const b = btns.find(x => x.dataset.v === v); if (b) b.click(); } };
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs = {}, children = []) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); for (const c of children) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); return e; }
  function provenanceTable(el, rows) {
    el.innerHTML = `<table><thead><tr><th>number</th><th>file</th><th>note</th></tr></thead><tbody>${rows.map(r => `<tr><td><code>${esc(r.n)}</code></td><td><code>${esc(r.f)}</code></td><td>${esc(r.note || "")}</td></tr>`).join("")}</tbody></table>`;
  }
  function topbar(el, opts) {
    const n = D.recorded && D.recorded.answers ? Object.keys(D.recorded.answers).length : 0;
    el.innerHTML = `<div class="crumbs"><a href="index.html">jev demos</a><span>/</span><b>${esc(opts.title)}</b></div><span class="pin" title="${n ? n + ' recorded answer maps on disk; a page turns green when it replays one' : 'no recorded answers on disk: run node demos/record.mjs with your key'}">twin · no live TypeSafe call · pin ${PIN}</span>`;
  }

  window.JEV = { Tape, twin, compose, esc, clamp, setLamp, stamp, tick, segControl, svg, SVGNS, provenanceTable, topbar, PIN, data: D };
})();
