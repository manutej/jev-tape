// Workflow script for the Workflow tool (plain JavaScript; not run by node directly).
// Ten Sonnet driver agents, one shard each, then one Haiku labeller per shard reading the recordings.
// args: { catalog, shards, rowsTotal, recordDir, resultsDir, stamp }
export const meta = {
  name: 'jev-vibium-parallel-corpus',
  description: 'Ten agents run Jev-gated Vibium measurements over a page catalog with recordings; Haiku reads the recordings for ground truth',
  phases: [
    { title: 'Drive', detail: 'one Sonnet agent per shard runs npm run corpus with recordings and Grok fallback', model: 'sonnet' },
    { title: 'Label', detail: 'one Haiku agent per shard reads each recording\'s last screenshot and answers the claim', model: 'haiku' },
  ],
}

const catalog = args.catalog
const shards = args.shards || 10
const total = args.rowsTotal
const per = Math.ceil(total / shards)
const ranges = Array.from({ length: shards }, (_, i) => [i * per, Math.min(total, (i + 1) * per) - 1]).filter(r => r[0] <= r[1])

const DRIVE_SCHEMA = {
  type: 'object',
  properties: {
    shard: { type: 'string' },
    resultsPath: { type: 'string' },
    itemsPath: { type: 'string' },
    manifestPath: { type: 'string' },
    summary: { type: 'object' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['shard', 'resultsPath', 'itemsPath', 'manifestPath', 'summary'],
}
const LABEL_SCHEMA = {
  type: 'object',
  properties: {
    shard: { type: 'string' },
    labels: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, claimTrue: { type: 'string', enum: ['yes', 'no', 'cannot-tell'] }, why: { type: 'string' } }, required: ['id', 'claimTrue'] } },
  },
  required: ['shard', 'labels'],
}

const out = await pipeline(
  ranges,
  ([a, b], _item, i) => agent(
    `You are shard ${i} of ${shards}. In /home/user/jev-tape run exactly:
npm run corpus -- --catalog ${catalog} --rows ${a}-${b} --workers 1 --record ${args.recordDir}/shard${i} --llm-fallback --session-prefix shard${i} --out ${args.resultsDir}/shard${i}.json --items ${args.resultsDir}/shard${i}.items.json
Environment must include VIBIUM_BIN, VIBIUM_CHROME_ARGS (already exported in this container) and the keys (already exported). Do not print or echo any key.
If a row reports nav-failed or error, do not retry it; list it under problems. Do not edit any file in the repo.
Then write the blinded manifest for the labellers with exactly:
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).results.filter(x=>x.recording).map(x=>({id:x.id,claim:x.claim,recording:x.recording}));require("fs").writeFileSync(process.argv[2],JSON.stringify(r,null,1))' ${args.resultsDir}/shard${i}.json ${args.resultsDir}/shard${i}.manifest.json
(The manifest carries id, claim and recording path only: no verdict, expect, answers, kind, or page text. That is what keeps the labels independent.)
Return: shard "${i}", resultsPath, itemsPath, manifestPath, the summary object printed on the last JSON line, and problems.`,
    { label: `drive:shard${i}`, phase: 'Drive', model: 'sonnet', effort: 'low', schema: DRIVE_SCHEMA },
  ),
  (drive, _item, i) => drive && agent(
    `Ground truth from recordings, shard ${i}. Read ONLY ${drive.manifestPath} (a blinded manifest: one entry per row with id, claim, and the path of its recording zip; it holds no verdicts, expectations, or page text). For each entry: unzip the recording into a temp dir, open the LAST screenshot image only, and decide from the image alone whether the claim is true of what the screenshot shows. Answer "yes", "no", or "cannot-tell". Do not open ${drive.resultsPath}, ${drive.itemsPath}, the catalog, or any other file. Return shard "${i}" and one label per row with a one-line why.`,
    { label: `label:shard${i}`, phase: 'Label', model: 'haiku', effort: 'low', schema: LABEL_SCHEMA },
  ).then(labels => ({ drive, labels })),
)

const done = out.filter(Boolean)
log(`${done.length}/${ranges.length} shards complete`)
return { stamp: args.stamp, shards: done }
