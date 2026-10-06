#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  let wiki = "wiki";
  let out = "wiki/site/index.html";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--wiki" && argv[i + 1]) wiki = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
    else throw new Error(`Unknown arg: ${argv[i]}`);
  }
  return { wiki, out };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error("Missing frontmatter");
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  if (!meta.id || !meta.title) throw new Error("Page needs id and title in frontmatter");
  return { meta, body: m[2] };
}

function loadPages(wikiDir) {
  const dir = path.join(wikiDir, "pages");
  const pages = new Map();
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(dir, name), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    if (meta.id !== name.slice(0, -3)) {
      throw new Error(`id ${meta.id} !== stem ${name}`);
    }
    pages.set(meta.id, { id: meta.id, title: meta.title, body });
  }
  return pages;
}

function parseIndex(indexText) {
  const groups = [];
  let current = { label: null, links: [] };
  const orderedIds = [];
  const seen = new Set();

  for (const line of indexText.split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      if (current.links.length || current.label) groups.push(current);
      current = { label: h[1].trim(), links: [] };
      continue;
    }
    const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let m;
    while ((m = re.exec(line))) {
      const id = m[1].trim();
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
        current.links.push(id);
      }
    }
  }
  if (current.links.length || current.label) groups.push(current);
  return { groups, orderedIds };
}

function renderInline(text, pageIds) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("[[", i)) {
      const end = text.indexOf("]]", i + 2);
      if (end !== -1) {
        const inner = text.slice(i + 2, end);
        const pipe = inner.indexOf("|");
        const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
        const label = pipe === -1 ? target : inner.slice(pipe + 1).trim();
        const missing = !pageIds.has(target);
        const cls = missing ? ' class="missing"' : "";
        parts.push(
          `<a href="#page-${escapeHtml(target)}"${cls}>${escapeHtml(label)}</a>`
        );
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        parts.push(`<code>${escapeHtml(text.slice(i + 1, end))}</code>`);
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        const inner = text.slice(i + 2, end);
        if (inner.length > 0) {
          parts.push(`<strong>${renderInline(inner, pageIds)}</strong>`);
          i = end + 2;
          continue;
        }
      }
    }
    if (text[i] === "*") {
      const prev = i > 0 ? text[i - 1] : " ";
      const next = i + 1 < text.length ? text[i + 1] : " ";
      if (!/[A-Za-z0-9_]/.test(prev) && !/[A-Za-z0-9_]/.test(next)) {
        const end = text.indexOf("*", i + 1);
        if (end !== -1 && end > i + 1) {
          const after = end + 1 < text.length ? text[end + 1] : " ";
          if (!/[A-Za-z0-9_]/.test(after)) {
            const inner = text.slice(i + 1, end);
            parts.push(`<em>${renderInline(inner, pageIds)}</em>`);
            i = end + 1;
            continue;
          }
        }
      }
    }
    parts.push(escapeHtml(text[i]));
    i++;
  }
  return parts.join("");
}

function isTableSep(line) {
  return /^\|?[\s:-]+\|[\s|:-]+$/.test(line.trim());
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function renderBlocks(body, pageIds) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      const level = hm[1].length;
      out.push(
        `<h${level}>${renderInline(hm[2], pageIds)}</h${level}>`
      );
      i++;
      continue;
    }
    if (isTableSep(lines[i + 1] ?? "")) {
      const header = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      let html = "<table><thead><tr>";
      for (const c of header) html += `<th>${renderInline(c, pageIds)}</th>`;
      html += "</tr></thead><tbody>";
      for (const row of rows) {
        html += "<tr>";
        for (const c of row) html += `<td>${renderInline(c, pageIds)}</td>`;
        html += "</tr>";
      }
      html += "</tbody></table>";
      out.push(html);
      continue;
    }
    const ol = line.match(/^(\d+)\.\s+(.+)$/);
    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ol || ul) {
      const ordered = !!ol;
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const o = l.match(/^(\d+)\.\s+(.+)$/);
        const u = l.match(/^[-*]\s+(.+)$/);
        if (ordered && o) items.push(o[2]);
        else if (!ordered && u) items.push(u[1]);
        else break;
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(
        `<${tag}>${items
          .map((t) => `<li>${renderInline(t, pageIds)}</li>`)
          .join("")}</${tag}>`
      );
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() !== "") {
      const l = lines[i];
      if (/^#{1,6}\s/.test(l)) break;
      if (/^[-*]\s/.test(l) || /^\d+\.\s/.test(l)) break;
      if (isTableSep(lines[i + 1] ?? "") || (l.includes("|") && lines[i + 1]?.includes("|")))
        break;
      para.push(l);
      i++;
    }
    out.push(`<p>${renderInline(para.join(" "), pageIds)}</p>`);
  }
  return out.join("\n");
}

function buildNav(groups, orderedIds, pages) {
  const inIndex = new Set(orderedIds);
  const parts = [];
  for (const g of groups) {
    if (g.label) parts.push(`<h2>${escapeHtml(g.label)}</h2>`);
    if (g.links.length) {
      parts.push("<ul>");
      for (const id of g.links) {
        const p = pages.get(id);
        if (!p) {
          parts.push(
            `<li><a href="#page-${escapeHtml(id)}" class="missing">${escapeHtml(id)}</a></li>`
          );
        } else {
          parts.push(
            `<li><a href="#page-${escapeHtml(id)}">${escapeHtml(p.title)}</a></li>`
          );
        }
      }
      parts.push("</ul>");
    }
  }
  const rest = [...pages.values()]
    .filter((p) => !inIndex.has(p.id))
    .sort((a, b) => a.title.localeCompare(b.title, "en"));
  if (rest.length) {
    parts.push("<ul>");
    for (const p of rest) {
      parts.push(
        `<li><a href="#page-${escapeHtml(p.id)}">${escapeHtml(p.title)}</a></li>`
      );
    }
    parts.push("</ul>");
  }
  return parts.join("\n");
}

function buildHtml(wikiDir) {
  const indexText = fs.readFileSync(path.join(wikiDir, "INDEX.md"), "utf8");
  const { groups, orderedIds } = parseIndex(indexText);
  const pages = loadPages(wikiDir);
  const pageIds = new Set(pages.keys());

  const sectionIds = [...pages.keys()].sort();
  const sections = sectionIds
    .map((id) => {
      const p = pages.get(id);
      try {
        const titleH = `<h1>${renderInline(p.title, pageIds)}</h1>`;
      return `<section id="page-${escapeHtml(id)}">\n${titleH}\n${renderBlocks(p.body, pageIds)}\n</section>`;
      } catch (e) {
        throw new Error(`${id}: ${e.message}`);
      }
    })
    .join("\n");

  const nav = buildNav(groups, orderedIds, pages);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>jev-tape wiki</title>
<style>
:root { font-family: system-ui, sans-serif; line-height: 1.5; }
body { margin: 0; display: flex; min-height: 100vh; }
nav { width: 16rem; padding: 1rem; border-right: 1px solid #ccc; overflow: auto; }
nav h2 { font-size: 0.85rem; margin: 1rem 0 0.25rem; text-transform: uppercase; color: #444; }
nav ul { list-style: none; padding: 0; margin: 0 0 0.5rem; }
nav a { text-decoration: none; color: #06c; }
nav a.missing { color: #c00; }
main { flex: 1; padding: 1.5rem 2rem; max-width: 48rem; }
section[hidden] { display: none; }
table { border-collapse: collapse; margin: 1rem 0; }
th, td { border: 1px solid #ccc; padding: 0.35rem 0.6rem; text-align: left; }
code { font-family: ui-monospace, monospace; font-size: 0.9em; background: #f4f4f4; padding: 0.1em 0.25em; border-radius: 3px; }
a.missing { color: #c00; }
</style>
</head>
<body>
<nav>
${nav}
</nav>
<main>
${sections}
</main>
<script>
(function () {
  var sections = document.querySelectorAll("main section[id^='page-']");
  function show(hash) {
    var target = hash || "#page-home";
    if (!target.startsWith("#")) target = "#" + target;
    sections.forEach(function (el) {
      el.hidden = "#" + el.id !== target;
    });
  }
  window.addEventListener("hashchange", function () { show(location.hash); });
  show(location.hash);
})();
</script>
</body>
</html>
`;
}

function main() {
  const { wiki, out } = parseArgs(process.argv);
  const wikiDir = path.resolve(wiki);
  const html = buildHtml(wikiDir);
  const outPath = path.resolve(out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main();
}
