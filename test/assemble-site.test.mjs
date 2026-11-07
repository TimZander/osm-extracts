// Requirements: "The manifest describes every region", "The site holds at most 19,000 files", "The
// deploy job accepts only well-formed region trees", "A failed region keeps its previous files", "The
// previous site is read from the data branch", "The site holds only the extract's files", "Files
// dropped from the manifest stay one more run", "The site sets its CORS and cache headers", "A missing
// file is a real 404", "The extract carries its licence notice".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, relative } from 'node:path'
import { assembleSite, validateManifest, cellFiles, HEADERS } from '../src/assemble-site.mjs'
import { buildCells } from '../src/cells.mjs'
import { CATEGORIES_FROM } from '../src/categories.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'osm-site-'))
const CO = { id: 'colorado', name: 'Colorado', geofabrik: 'north-america/us/colorado', bounds: { south: 37, west: -109.06, north: 41, east: -102.04 }, clip: false }
const UT = { id: 'utah', name: 'Utah', geofabrik: 'north-america/us/utah', bounds: { south: 37, west: -114.05, north: 42, east: -109.05 }, clip: false }

const peak = (id, lon, lat) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { title: '', _osmCategories: ['peaks'], _osmId: `node/${id}` },
})

function write(root, path, text) {
  const f = join(root, path)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, text)
}

// A region artifact as the region job uploads it: region-<id>/{entry.json, stats.json, <id>/...}.
// download-artifact puts a lone artifact straight in the target folder (so only the wrapper the
// region job uploaded remains: region-<id>/...), and two or more each in a folder named for the
// artifact (region-<id>/region-<id>/...). `wrapped` gives the second layout.
function artifact(artifacts, region, features, { dataDate = '2026-10-28', threshold, entryOver = {}, wrapped = false } = {}) {
  const built = buildCells(region.id, features, threshold ? { threshold } : {})
  const root = wrapped ? join(artifacts, `region-${region.id}`, `region-${region.id}`) : join(artifacts, `region-${region.id}`)
  for (const [p, t] of built.files) write(root, p, t)
  const entry = { id: region.id, name: region.name, bounds: region.bounds, dataDate, cells: built.cells, split: built.split, ...entryOver }
  write(root, 'entry.json', JSON.stringify(entry))
  write(root, 'stats.json', JSON.stringify(built.stats))
  return { root, entry, built }
}

// A previous data tree holding the given region entries and their files.
function previous(prev, entries, filesByRegion) {
  for (const files of filesByRegion) for (const [p, t] of files) write(prev, p, t)
  write(prev, 'manifest.json', JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL)', categoriesFrom: CATEGORIES_FROM, regions: entries }))
  write(prev, '_headers', HEADERS)
  write(prev, '404.html', 'x')
  write(prev, 'LICENSE.txt', 'x')
}

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

function setup() {
  const d = tmp()
  const dirs = { previousDir: join(d, 'prev'), artifactsDir: join(d, 'art'), outDir: join(d, 'site') }
  mkdirSync(dirs.previousDir)
  mkdirSync(dirs.artifactsDir)
  return dirs
}

const run = (dirs, regions = [CO], extra = {}) => assembleSite({ regions, ...dirs, log: () => {}, ...extra })

test('a first run: manifest, headers, 404, licence and the region files', () => {
  const dirs = setup()
  const { built } = artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603), peak(2, -105.9, 39.6)])
  run(dirs)
  const manifest = JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json'), 'utf8'))
  assert.deepEqual(manifest, {
    attribution: '© OpenStreetMap contributors (ODbL)',
    categoriesFrom: CATEGORIES_FROM,
    regions: [{ id: 'colorado', name: 'Colorado', bounds: CO.bounds, dataDate: '2026-10-28', cells: ['158_-425', '158_-424'], split: [] }],
  })
  assert.deepEqual(Object.keys(manifest.regions[0]), ['id', 'name', 'bounds', 'dataDate', 'cells', 'split'])
  assert.deepEqual(Object.keys(manifest.regions[0].bounds), ['south', 'west', 'north', 'east'])
  validateManifest(manifest)
  assert.deepEqual(listFiles(dirs.outDir), ['404.html', 'LICENSE.txt', '_headers', 'colorado/158_-424.json', 'colorado/158_-425.json', 'manifest.json'])
  for (const [p, t] of built.files) assert.equal(readFileSync(join(dirs.outDir, p), 'utf8'), t)
  assert.equal(readFileSync(join(dirs.outDir, '_headers'), 'utf8'), HEADERS)
  assert.match(readFileSync(join(dirs.outDir, '404.html'), 'utf8'), /<title>Not found<\/title>/)
})

test('the placeholder branch counts as no previous regions, and its page goes', () => {
  const dirs = setup()
  write(dirs.previousDir, 'index.html', '<p>placeholder</p>')
  write(dirs.previousDir, '404.html', '<p>placeholder</p>')
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  run(dirs)
  assert.ok(!existsSync(join(dirs.outDir, 'index.html')))
  assert.equal(JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json'))).regions.length, 1)
})

test('a broken previous manifest fails, writing nothing', () => {
  const dirs = setup()
  write(dirs.previousDir, 'manifest.json', '{not json')
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  assert.throws(() => run(dirs), /previous manifest/i)
  assert.equal(existsSync(dirs.outDir), false)
})

test('a previous manifest of the wrong form, or listing a missing file, fails', () => {
  const dirs = setup()
  write(dirs.previousDir, 'manifest.json', JSON.stringify({ attribution: 'x', regions: [{ id: '..', name: 'x', bounds: CO.bounds, dataDate: '2026-01-01', cells: [] }] }))
  assert.throws(() => run(dirs), /previous manifest/i)
  const dirs2 = setup()
  write(dirs2.previousDir, 'manifest.json', JSON.stringify({ attribution: 'x', regions: [{ id: 'colorado', name: 'Colorado', bounds: CO.bounds, dataDate: '2026-01-01', cells: ['1_1'] }] }))
  assert.throws(() => run(dirs2), /previous.*colorado\/1_1\.json/i)
  assert.equal(existsSync(dirs2.outDir), false)
})

test('a symbolic link in the previous tree fails, naming it', () => {
  const dirs = setup()
  const elsewhere = join(dirname(dirs.previousDir), 'elsewhere')
  write(elsewhere, '158_-425.json', '{"type":"FeatureCollection","features":[]}\n')
  write(dirs.previousDir, 'manifest.json', JSON.stringify({ attribution: 'x', regions: [{ id: 'colorado', name: 'Colorado', bounds: CO.bounds, dataDate: '2026-01-01', cells: ['158_-425'] }] }))
  symlinkSync(elsewhere, join(dirs.previousDir, 'colorado'))
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  assert.throws(() => run(dirs), /symbolic link.*colorado/)
  assert.equal(existsSync(dirs.outDir), false)
  const d2 = setup()
  symlinkSync('/etc/hostname', join(d2.previousDir, 'manifest.json'))
  assert.throws(() => run(d2), /symbolic link.*manifest\.json/)
})

test('a failed region keeps last run\'s entry and files', () => {
  const dirs = setup()
  const old = buildCells('colorado', [peak(1, -106.062, 39.603)])
  const oldEntry = { id: 'colorado', name: 'Colorado', bounds: CO.bounds, dataDate: '2026-10-21', cells: old.cells, split: old.split }
  previous(dirs.previousDir, [oldEntry], [old.files])
  // utah succeeds, colorado has no artifact (its job failed).
  artifact(dirs.artifactsDir, UT, [peak(9, -111.5, 40.5)])
  run(dirs, [CO, UT])
  const m = JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json')))
  assert.deepEqual(m.regions.map((r) => [r.id, r.dataDate]), [['colorado', '2026-10-21'], ['utah', '2026-10-28']])
  for (const [p, t] of old.files) assert.equal(readFileSync(join(dirs.outDir, p), 'utf8'), t)
})

test('a failed region never published is left out', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  run(dirs, [CO, UT])
  assert.deepEqual(JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json'))).regions.map((r) => r.id), ['colorado'])
})

test('a region taken off the list leaves the manifest; its files stay one run', () => {
  const dirs = setup()
  const ut = buildCells('utah', [peak(9, -111.5, 40.5)])
  previous(dirs.previousDir, [{ id: 'utah', name: 'Utah', bounds: UT.bounds, dataDate: '2026-10-21', cells: ut.cells, split: [] }], [ut.files])
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  run(dirs, [CO])
  const m = JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json')))
  assert.deepEqual(m.regions.map((r) => r.id), ['colorado'])
  for (const p of ut.files.keys()) assert.ok(existsSync(join(dirs.outDir, p)), p)
})

test('a cell that became split keeps its whole file one more run; two runs later it is gone', () => {
  const dirs = setup()
  const fs = [peak(1, -106.062, 39.603), peak(2, -106.07, 39.61)]
  const old = buildCells('colorado', fs)
  previous(dirs.previousDir, [{ id: 'colorado', name: 'Colorado', bounds: CO.bounds, dataDate: '2026-10-21', cells: old.cells, split: [] }], [old.files])
  artifact(dirs.artifactsDir, CO, fs, { threshold: 100 })
  run(dirs)
  const files = listFiles(dirs.outDir)
  assert.ok(files.includes('colorado/158_-425.json'), 'carried over')
  assert.ok(files.includes('colorado/158_-425/316_-849.json'))

  // The next run reads this site as its previous tree: the whole file is no longer listed, so it goes.
  const next = { previousDir: dirs.outDir, artifactsDir: join(dirname(dirs.outDir), 'art2'), outDir: join(dirname(dirs.outDir), 'site2') }
  mkdirSync(next.artifactsDir)
  artifact(next.artifactsDir, CO, fs, { threshold: 100 })
  run(next)
  assert.ok(!listFiles(next.outDir).includes('colorado/158_-425.json'))
})

test('stray or malformed artifacts fail the deploy, naming the region', () => {
  const cases = [
    ['a stray _headers', (a) => write(a.root, '_headers', 'x')],
    ['a stray index.html', (a) => write(a.root, 'index.html', 'x')],
    ['an unlisted cell file', (a) => write(a.root, 'colorado/1_1.json', '{}')],
    ['a file outside the cell layout', (a) => write(a.root, 'colorado/evil.js', 'x')],
    ['a listed cell with no file', (a) => write(a.root, 'entry.json', JSON.stringify({ ...a.entry, cells: [...a.entry.cells, '1_1'] }))],
    ['other bounds', (a) => write(a.root, 'entry.json', JSON.stringify({ ...a.entry, bounds: { ...CO.bounds, north: 45 } }))],
    ['another name', (a) => write(a.root, 'entry.json', JSON.stringify({ ...a.entry, name: 'Evil' }))],
    ['another id', (a) => write(a.root, 'entry.json', JSON.stringify({ ...a.entry, id: 'utah' }))],
    ['a bad date', (a) => write(a.root, 'entry.json', JSON.stringify({ ...a.entry, dataDate: '28/10/2026' }))],
    ['split not in cells', (a) => write(a.root, 'entry.json', JSON.stringify({ ...a.entry, split: ['1_1'] }))],
    ['a symlink', (a) => symlinkSync('/etc/passwd', join(a.root, 'colorado', '9_9.json'))],
    ['no entry', (a) => write(a.root, 'entry.json', 'nope')],
  ]
  for (const [what, mutate] of cases) {
    const dirs = setup()
    const a = artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
    mutate(a)
    assert.throws(() => run(dirs), /colorado/, what)
    assert.equal(existsSync(dirs.outDir), false, what)
  }
})

test('two artifacts, each in a folder named for it', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)], { wrapped: true })
  artifact(dirs.artifactsDir, UT, [peak(9, -111.5, 40.5)], { wrapped: true })
  run(dirs, [CO, UT])
  const m = JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json')))
  assert.deepEqual(m.regions.map((r) => r.id), ['colorado', 'utah'])
  assert.ok(existsSync(join(dirs.outDir, 'utah/162_-446.json')))
})

test('with two artifacts, one not in its own folder fails', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)], { wrapped: true })
  artifact(dirs.artifactsDir, UT, [peak(9, -111.5, 40.5)])
  assert.throws(() => run(dirs, [CO, UT]), /utah/)
  assert.equal(existsSync(dirs.outDir), false)
})

test('a wrapper whose inner folder names another region fails', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)], { wrapped: true })
  const ut = artifact(join(dirs.artifactsDir, 'region-utah'), UT, [peak(9, -111.5, 40.5)])
  mkdirSync(join(dirs.artifactsDir, 'region-utah', 'x'))
  void ut
  assert.throws(() => run(dirs, [CO, UT]), /utah/)
})

test('no artifact at all (every region failed) keeps the previous site', () => {
  const dirs = setup()
  const old = buildCells('colorado', [peak(1, -106.062, 39.603)])
  previous(dirs.previousDir, [{ id: 'colorado', name: 'Colorado', bounds: CO.bounds, dataDate: '2026-10-21', cells: old.cells, split: [] }], [old.files])
  run(dirs)
  assert.equal(JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json'))).regions[0].dataDate, '2026-10-21')
})

test('a missing artifacts folder counts as no artifact', () => {
  const dirs = setup()
  run({ ...dirs, artifactsDir: join(dirs.artifactsDir, 'none') })
  assert.deepEqual(JSON.parse(readFileSync(join(dirs.outDir, 'manifest.json'))).regions, [])
})

test('an artifact for a region not on the list, or not named region-<id>, fails', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)], { wrapped: true })
  artifact(dirs.artifactsDir, UT, [peak(9, -111.5, 40.5)], { wrapped: true })
  assert.throws(() => run(dirs, [CO]), /utah/)
  const dirs2 = setup()
  mkdirSync(join(dirs2.artifactsDir, 'something'))
  assert.throws(() => run(dirs2), /something/)
})

test('an artifact file over 20 MiB fails', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  assert.throws(() => run(dirs, [CO], { maxFile: 10 }), /colorado\/158_-425\.json/)
  assert.equal(existsSync(dirs.outDir), false)
})

test('more than the file limit fails with the counts, writing nothing', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603), peak(2, -105.9, 39.6)])
  // 2 region files + manifest, _headers, 404.html, LICENSE.txt = 6.
  assert.throws(() => run(dirs, [CO], { maxFiles: 5 }), (e) => /6 files/.test(e.message) && /colorado: 2/.test(e.message))
  assert.equal(existsSync(dirs.outDir), false)
  const ok = setup()
  artifact(ok.artifactsDir, CO, [peak(1, -106.062, 39.603), peak(2, -105.9, 39.6)])
  run(ok, [CO], { maxFiles: 6 })
})

// Pages' _headers matching: `*` matches anything (slashes too), `:name` one path segment.
function headersFor(path, text = HEADERS) {
  const got = {}
  let current = null
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      const re = new RegExp('^' + raw.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:[a-z]+/g, '[^/]+') + '$')
      current = re.test(path)
      continue
    }
    if (current) {
      const [k, ...v] = raw.trim().split(':')
      ;(got[k.toLowerCase()] ??= []).push(v.join(':').trim())
    }
  }
  return got
}

test('headers: CORS everywhere, one Cache-Control per path', () => {
  assert.deepEqual(headersFor('/manifest.json'), { 'access-control-allow-origin': ['*'], 'cache-control': ['public, max-age=300'] })
  assert.deepEqual(headersFor('/colorado/158_-425/316_-849.json'), { 'access-control-allow-origin': ['*'], 'cache-control': ['public, max-age=3600'] })
  assert.deepEqual(headersFor('/colorado/158_-425.json'), { 'access-control-allow-origin': ['*'], 'cache-control': ['public, max-age=3600'] })
  assert.deepEqual(headersFor('/LICENSE.txt'), { 'access-control-allow-origin': ['*'], 'cache-control': ['public, max-age=3600'] })
  assert.deepEqual(headersFor('/404.html')['access-control-allow-origin'], ['*'])
})

test('the licence notice', () => {
  const dirs = setup()
  artifact(dirs.artifactsDir, CO, [peak(1, -106.062, 39.603)])
  run(dirs)
  const text = readFileSync(join(dirs.outDir, 'LICENSE.txt'), 'utf8')
  for (const want of ['OpenStreetMap contributors', 'ODbL 1.0', 'derived database', 'Geofabrik', 'Colorado', '2026-10-28', 'https://github.com/TimZander/osm-extracts']) {
    assert.ok(text.includes(want), want)
  }
})

test('the manifest form the consumer reads', () => {
  const good = { attribution: 'a', regions: [{ id: 'colorado', name: 'C', bounds: CO.bounds, dataDate: '2026-10-28', cells: ['158_-425'] }] }
  validateManifest(good)
  const bad = [
    { ...good, regions: [{ ...good.regions[0], cells: ['../../etc'] }] },
    { ...good, regions: [{ ...good.regions[0], cells: ['01_2'] }] },
    { ...good, regions: [{ ...good.regions[0], cells: ['-0_2'] }] },
    { ...good, regions: [{ ...good.regions[0], cells: ['+1_2'] }] },
    { ...good, regions: [{ ...good.regions[0], id: '//evil.example' }] },
    { ...good, regions: [{ ...good.regions[0], bounds: { ...CO.bounds, south: '37' } }] },
    { ...good, regions: [{ ...good.regions[0], cells: undefined }] },
    { ...good, attribution: 3 },
  ]
  for (const m of bad) assert.throws(() => validateManifest(m))
})

test('cell files', () => {
  assert.deepEqual(cellFiles('colorado', { cells: ['158_-425', '158_-424'], split: ['158_-425'] }), [
    'colorado/158_-425/316_-850.json',
    'colorado/158_-425/316_-849.json',
    'colorado/158_-425/317_-850.json',
    'colorado/158_-425/317_-849.json',
    'colorado/158_-424.json',
  ])
})
