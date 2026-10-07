import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildScript = path.join(repoRoot, "scripts", "build-wiki.mjs");

function writePage(dir: string, id: string, title: string, body = "") {
  const text = `---\nid: ${id}\ntitle: ${title}\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(dir, "pages", `${id}.md`), text, "utf8");
}

function runBuild(wikiDir: string, outFile: string) {
  execFileSync(process.execPath, [buildScript, "--wiki", wikiDir, "--out", outFile], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}

test("build-wiki emits section ids for in-wiki pages", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jev-wiki-"));
  const wiki = path.join(tmp, "wiki");
  fs.mkdirSync(path.join(wiki, "pages"), { recursive: true });
  fs.writeFileSync(path.join(wiki, "INDEX.md"), "Start: [[home]]\n", "utf8");
  writePage(wiki, "home", "Home", "# Home\n");

  const out = path.join(tmp, "index.html");
  runBuild(wiki, out);
  const html = fs.readFileSync(out, "utf8");
  assert.match(html, /<section id="page-home"/);
});

test("build-wiki skips pages that symlink outside the wiki", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jev-wiki-"));
  const wiki = path.join(tmp, "wiki");
  const outside = path.join(tmp, "outside");
  fs.mkdirSync(path.join(wiki, "pages"), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(wiki, "INDEX.md"), "Start: [[home]]\n", "utf8");
  writePage(wiki, "home", "Home", "# Home\n");
  fs.writeFileSync(
    path.join(outside, "leak.md"),
    "---\nid: leak\ntitle: Outside\n---\n\n# Outside Secret\n",
    "utf8"
  );
  fs.symlinkSync(path.join(outside, "leak.md"), path.join(wiki, "pages", "leak.md"));

  const out = path.join(tmp, "index.html");
  runBuild(wiki, out);
  const html = fs.readFileSync(out, "utf8");
  assert.match(html, /<section id="page-home"/);
  assert.doesNotMatch(html, /<section id="page-leak"/);
});
