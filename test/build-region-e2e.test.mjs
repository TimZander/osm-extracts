// End-to-end: build-region.mjs with the real osmium on a small fixture (download.geofabrik.de is not
// reachable from the build environment, so the downloads are replaced by local files). Requirements:
// "The extract holds exactly what the import's categories select", "Each feature's form", "Features
// are filed into 0.25° cells", "A dense cell is split into its four quarters", "The data date is the
// source's replication time", "A region's bounds lie inside its Geofabrik polygon", "A clipped region
// is cut to its bounds", "The output is byte-stable", "The manifest lists exactly the files written",
// "Each region lists the cells it covers", "A clipped region covers its bounds' cells", "The manifest
// describes every region", "Each region job reports its size".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { buildRegion } from '../src/build-region.mjs'
import { coveredCells, parsePoly } from '../src/poly.mjs'

let osmiumOk = true
try {
  execFileSync('osmium', ['--version'], { stdio: 'ignore' })
} catch {
  osmiumOk = false
}
const skip = osmiumOk ? false : 'osmium-tool is not installed'

const fixture = (f) => new URL(`./fixtures/${f}`, import.meta.url).pathname
const tmp = () => mkdtempSync(join(tmpdir(), 'osm-e2e-'))

function makePbf(dir, timestamp) {
  const pbf = join(dir, 'sample.osm.pbf')
  const args = ['cat', fixture('sample.osm'), '-o', pbf, '--overwrite']
  if (timestamp) args.push(`--output-header=osmosis_replication_timestamp=${timestamp}`)
  execFileSync('osmium', args)
  const md5 = join(dir, 'sample.md5')
  writeFileSync(md5, `${createHash('md5').update(readFileSync(pbf)).digest('hex')}  sample-latest.osm.pbf\n`)
  return { pbf, md5, poly: fixture('sample.poly') }
}

const region = (over = {}) => ({
  id: 'sample',
  name: 'Sample',
  geofabrik: 'north-america/us/sample',
  bounds: { south: 39, west: -107, north: 40, east: -105 },
  clip: false,
  ...over,
})

function listFiles(dir) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      e.isDirectory() ? walk(p) : out.push(relative(dir, p))
    }
  }
  walk(dir)
  return out.sort()
}

const quiet = () => {}

test('a region builds end to end', { skip }, async () => {
  const dir = tmp()
  const out = join(dir, 'out')
  const { entry, stats } = await buildRegion({ id: 'sample', out, regions: [region()], local: makePbf(dir, '2026-10-28T20:21:02Z'), log: quiet })
  assert.equal(entry.dataDate, '2026-10-28')
  assert.deepEqual(entry.bounds, { south: 39, west: -107, north: 40, east: -105 })
  const files = listFiles(out)
  assert.ok(files.includes('entry.json') && files.includes('stats.json'))
  const cellFiles = files.filter((f) => f.startsWith('sample/'))
  assert.deepEqual(cellFiles, entry.cells.map((c) => `sample/${c}.json`).sort())
  assert.deepEqual(entry.split, [])
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'entry.json'))), entry)
  assert.equal(JSON.parse(readFileSync(join(out, 'stats.json'))).files, stats.files)

  const all = new Map()
  for (const f of cellFiles) {
    for (const feat of JSON.parse(readFileSync(join(out, f))).features) all.set(feat.properties._osmId, feat)
  }
  // Selected: peaks (101, 303, 5 and 304, unclipped), volcano 305, closed footway 201, trail 202,
  // track-ridge 204, forest roads 205 (service, by name) and 206 (track, by ref). Not 207, a service
  // road called "Forest Road" ("Which ways are forest roads").
  assert.deepEqual([...all.keys()].sort(), ['node/101', 'node/303', 'node/304', 'node/305', 'node/5', 'way/201', 'way/202', 'way/204', 'way/205', 'way/206'].sort())
  assert.deepEqual(all.get('node/305').properties._osmCategories, ['peaks'])
  assert.deepEqual(all.get('way/205').properties._osmCategories, ['forest_roads'])
  assert.deepEqual(all.get('way/206').properties._osmCategories, ['forest_roads', 'trails'])
  assert.deepEqual(all.get('node/101'), {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-106.062, 39.625] },
    properties: { title: 'Example Peak', _osmCategories: ['peaks'], _osmId: 'node/101' },
  })
  assert.deepEqual(all.get('node/303').properties._osmCategories, ['peaks', 'passes'])
  assert.equal(all.get('way/201').geometry.type, 'LineString')
  assert.deepEqual(all.get('way/201').geometry.coordinates.at(0), all.get('way/201').geometry.coordinates.at(-1))
  assert.deepEqual(all.get('way/204').properties._osmCategories, ['trails', 'ridges'])
  // The trail across the cell edge is in both cells, whole.
  const edge = (c) => JSON.parse(readFileSync(join(out, `sample/${c}.json`))).features.some((f) => f.properties._osmId === 'way/202')
  assert.ok(edge('158_-425') && edge('158_-424'))
  assert.equal(stats.nodes, 5)
  assert.equal(stats.ways, 5)
})

test('the size report reaches the job summary', { skip }, async () => {
  const dir = tmp()
  const summary = join(dir, 'summary.md')
  writeFileSync(summary, '')
  const before = process.env.GITHUB_STEP_SUMMARY
  process.env.GITHUB_STEP_SUMMARY = summary
  try {
    const { stats } = await buildRegion({ id: 'sample', out: join(dir, 'out'), regions: [region()], local: makePbf(dir, '2026-10-28T20:21:02Z'), log: quiet })
    const text = readFileSync(summary, 'utf8')
    assert.match(text, /### Region sample/)
    assert.ok(text.includes(`| ${stats.nodes} | ${stats.ways} | ${stats.totalBytes} | ${stats.largestCell.id} (${stats.largestCell.bytes} bytes) | ${stats.cells} | ${stats.splitCells} | ${stats.files} | ${stats.coverageCells} |`))
    assert.match(text, /\| Coverage cells \|/)
  } finally {
    if (before === undefined) delete process.env.GITHUB_STEP_SUMMARY
    else process.env.GITHUB_STEP_SUMMARY = before
  }
})

test('the same source built twice is byte-identical', { skip }, async () => {
  const dir = tmp()
  const src = makePbf(dir, '2026-10-28T20:21:02Z')
  const a = join(dir, 'a')
  const b = join(dir, 'b')
  await buildRegion({ id: 'sample', out: a, regions: [region()], local: src, log: quiet })
  await buildRegion({ id: 'sample', out: b, regions: [region()], local: src, log: quiet })
  const fa = listFiles(a)
  assert.deepEqual(fa, listFiles(b))
  for (const f of fa) assert.ok(readFileSync(join(a, f)).equals(readFileSync(join(b, f))), f)
})

test('a dense cell splits end to end', { skip }, async () => {
  const dir = tmp()
  const out = join(dir, 'out')
  const { entry } = await buildRegion({ id: 'sample', out, regions: [region()], local: makePbf(dir, '2026-10-28T20:21:02Z'), threshold: 300, log: quiet })
  assert.ok(entry.split.includes('158_-425'))
  for (const q of ['316_-850', '316_-849', '317_-850', '317_-849']) assert.ok(existsSync(join(out, `sample/158_-425/${q}.json`)), q)
  assert.ok(!existsSync(join(out, 'sample/158_-425.json')))
})

test('a clipped region holds no point outside its bounds, and keeps whole ways', { skip }, async () => {
  const dir = tmp()
  const out = join(dir, 'out')
  const { entry } = await buildRegion({ id: 'sample', out, regions: [region({ clip: true })], local: makePbf(dir, '2026-10-28T20:21:02Z'), log: quiet })
  const ids = new Map()
  for (const c of entry.cells) {
    for (const f of JSON.parse(readFileSync(join(out, `sample/${c}.json`))).features) ids.set(f.properties._osmId, f)
  }
  assert.ok(!ids.has('node/304'), 'a peak north of the bounds')
  assert.ok(!ids.has('node/5'), 'a peak north of the bounds on a kept track')
  assert.equal(ids.get('way/204').geometry.coordinates.length, 2, 'the track is whole')
})

test('an undated PBF fails and writes nothing', { skip }, async () => {
  const dir = tmp()
  const out = join(dir, 'out')
  await assert.rejects(buildRegion({ id: 'sample', out, regions: [region()], local: makePbf(dir, null), log: quiet }), /replication timestamp/)
  assert.equal(existsSync(out), false)
})

test('bounds reaching outside the polygon fail naming the region', { skip }, async () => {
  const dir = tmp()
  const out = join(dir, 'out')
  const r = region({ bounds: { south: 39, west: -108, north: 40, east: -105 } })
  await assert.rejects(buildRegion({ id: 'sample', out, regions: [r], local: makePbf(dir, '2026-10-28T20:21:02Z'), log: quiet }), /region sample: its bounds reach outside its Geofabrik polygon: south-west corner \(39, -108\) is outside the polygon$/)
  assert.equal(existsSync(out), false)
})

test('a file over the limit fails naming it, and writes nothing', { skip }, async () => {
  const dir = tmp()
  const out = join(dir, 'out')
  await assert.rejects(
    buildRegion({ id: 'sample', out, regions: [region()], local: makePbf(dir, '2026-10-28T20:21:02Z'), maxFile: 100, log: quiet }),
    /sample\/.*\.json is \d+ bytes/,
  )
  assert.equal(existsSync(out), false)
})

// Requirement "The bounds guard names the first failing point": the job's error, for each kind.
test('the job names a ring vertex, or a ring edge, that fails the bounds', { skip }, async () => {
  const dir = tmp()
  const src = makePbf(dir, '2026-10-28T20:21:02Z')
  const cases = [
    ['ring vertex (39.5, -105.5) is inside the bounds', 'n\n1\n -110 36.5\n -101 36.5\n -101 41.5\n -105.5 41.5\n -105.5 39.5\n -105.6 39.4\n -105.6 41.5\n -110 41.5\nEND\nEND\n'],
    ['ring edge from (38, -106) to (41, -106.2) meets the bounds', 'e\na\n -110 36.5\n -101 36.5\n -101 41.5\n -110 41.5\nEND\nb\n -106 38\n -106.2 41\n -106.1 41.5\nEND\nEND\n'],
  ]
  for (const [want, polyText] of cases) {
    const poly = join(dir, `${want.length}.poly`)
    writeFileSync(poly, polyText)
    const r = region({ bounds: { south: 39, west: -108, north: 40, east: -105 } })
    await assert.rejects(
      buildRegion({ id: 'sample', out: join(dir, `out-${want.length}`), regions: [r], local: { ...src, poly }, log: quiet }),
      (e) => e.message === `region sample: its bounds reach outside its Geofabrik polygon: ${want}`,
    )
  }
})

// A polygon smaller than the data: 38.5 to 40.5 by -107.5 to -104.5 (8 rows × 12 columns). The peaks
// at 40.6 and 40.7 lie north of it, in row 162.
const SMALL_POLY = `small
1
   -107.5   38.5
   -104.5   38.5
   -104.5   40.5
   -107.5   40.5
   -107.5   38.5
END
END
`

test('the entry lists every cell its polygon covers, empty ones included, and no cell past it', { skip }, async () => {
  const dir = tmp()
  const poly = join(dir, 'small.poly')
  writeFileSync(poly, SMALL_POLY)
  const out = join(dir, 'out')
  const { entry, stats } = await buildRegion({ id: 'sample', out, regions: [region()], local: { ...makePbf(dir, '2026-10-28T20:21:02Z'), poly }, log: quiet })
  assert.deepEqual(Object.keys(entry), ['id', 'name', 'bounds', 'dataDate', 'cells', 'split', 'coverage'])
  assert.deepEqual(entry.coverage, coveredCells(parsePoly(SMALL_POLY)))
  assert.equal(entry.coverage.length, 96)
  assert.equal(stats.coverageCells, 96)
  // An empty covered cell: listed in coverage, not in cells, no file.
  assert.ok(entry.coverage.includes('160_-420') && !entry.cells.includes('160_-420'))
  assert.ok(!existsSync(join(out, 'sample/160_-420.json')))
  // A cell with a file past the polygon: in cells, written, not in coverage.
  const past = entry.cells.filter((c) => Number(c.split('_')[0]) >= 162)
  assert.ok(past.length > 0)
  for (const c of past) {
    assert.ok(existsSync(join(out, `sample/${c}.json`)), c)
    assert.ok(!entry.coverage.includes(c), c)
  }
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'entry.json'))), entry)
})

test('a clipped region covers its bounds\' cells, not its polygon\'s', { skip }, async () => {
  const dir = tmp()
  const r = region({ clip: true, bounds: { south: 39.1, west: -106.6, north: 39.5, east: -106.0 } })
  const { entry } = await buildRegion({ id: 'sample', out: join(dir, 'out'), regions: [r], local: makePbf(dir, '2026-10-28T20:21:02Z'), log: quiet })
  const want = ['156_-427', '156_-426', '156_-425', '157_-427', '157_-426', '157_-425']
  assert.deepEqual(entry.coverage, want)
})
