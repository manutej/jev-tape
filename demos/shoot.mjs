// screenshot every demo with the preinstalled chromium; report console errors
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('.').filter(f => f.endsWith('.html'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let bad = 0;
for (const f of files) {
  for (const [w, h, tag] of [[1280, 900, 'desk'], [390, 844, 'phone']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.goto('file://' + resolve(f), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    // drive the primary button if present
    const btn = await page.$('#run, [data-run], .btn.primary');
    if (btn && tag === 'desk') { try { await btn.click(); await page.waitForTimeout(2200); } catch (e) { errs.push('click: ' + e.message); } }
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (hscroll) errs.push('horizontal overflow at ' + w);
    await page.screenshot({ path: `shots/${f.replace('.html', '')}-${tag}.png`, fullPage: tag === 'desk' });
    const netErrs = errs.filter(e => !/googleapis|gstatic|net::ERR_/.test(e));
    console.log(`${f} @${tag}: ${netErrs.length ? 'ISSUES ' + netErrs.join(' ; ') : 'ok'}`);
    if (netErrs.length) bad++;
    await page.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
