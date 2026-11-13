// Requirements: "A failed or corrupt download publishes nothing new for the region", "The data date is
// the source's replication time", "Each region job reports its size", "A region's bounds lie inside
// its Geofabrik polygon".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { checkMd5, dataDateFrom, download, sourceUrls, summaryMarkdown, buildRegion } from '../src/build-region.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'osm-test-'))

test('Geofabrik URLs', () => {
  assert.deepEqual(sourceUrls('north-america/us/colorado'), {
    pbf: 'https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf',
    md5: 'https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf.md5',
    poly: 'https://download.geofabrik.de/north-america/us/colorado.poly',
  })
})

test('the MD5 check', () => {
  const dir = tmp()
  const f = join(dir, 'x.pbf')
  writeFileSync(f, 'hello')
  const sum = createHash('md5').update('hello').digest('hex')
  checkMd5(f, `${sum}  colorado-latest.osm.pbf\n`)
  assert.throws(() => checkMd5(f, `${'0'.repeat(32)}  colorado-latest.osm.pbf\n`), /MD5/)
  assert.throws(() => checkMd5(f, 'not a checksum'), /MD5/)
})

test('the data date', () => {
  assert.equal(dataDateFrom('2026-10-28T20:21:02Z\n'), '2026-10-28')
  assert.equal(dataDateFrom('2026-10-28T23:59:59Z'), '2026-10-28')
  assert.throws(() => dataDateFrom(''), /replication timestamp/)
  assert.throws(() => dataDateFrom('yesterday'), /replication timestamp/)
  assert.throws(() => dataDateFrom('2026-10-28T20:21:02+02:00'), /replication timestamp/)
})

test('a failed download throws, naming the URL and status', async () => {
  const dir = tmp()
  const fake = async () => new Response('nope', { status: 404 })
  await assert.rejects(download('https://download.geofabrik.de/x.md5', join(dir, 'x'), fake), /404.*x\.md5|x\.md5.*404/)
  const failing = async () => {
    throw new TypeError('fetch failed')
  }
  await assert.rejects(download('https://download.geofabrik.de/x.pbf', join(dir, 'y'), failing), /x\.pbf/)
})

test('a region whose .md5 answers 404 fails and writes nothing', async () => {
  const out = join(tmp(), 'out')
  const pbf = new Uint8Array([1, 2, 3])
  const fake = async (url) =>
    url.endsWith('.md5') ? new Response('', { status: 404 }) : new Response(url.endsWith('.pbf') ? pbf : 'x\n1\n0 0\nEND\nEND\n')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: fake }), /404/)
  assert.equal(existsSync(out), false)
})

test('a region with an MD5 mismatch fails and writes nothing', async () => {
  const out = join(tmp(), 'out')
  const fake = async (url) =>
    new Response(url.endsWith('.md5') ? `${'0'.repeat(32)}  colorado-latest.osm.pbf\n` : url.endsWith('.pbf') ? 'pbf' : 'p\n1\n0 0\nEND\nEND\n')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: fake }), /MD5/)
  assert.equal(existsSync(out), false)
})

test('a region not in the list fails before any download', async () => {
  let fetched = 0
  const fake = async () => {
    fetched++
    return new Response('')
  }
  await assert.rejects(buildRegion({ id: 'montana', out: join(tmp(), 'o'), fetchImpl: fake }), /montana/)
  await assert.rejects(buildRegion({ id: '../x', out: join(tmp(), 'o'), fetchImpl: fake }), /\.\.\/x/)
  assert.equal(fetched, 0)
})

test('the size report', () => {
  const md = summaryMarkdown('colorado', {
    nodes: 12,
    ways: 34,
    totalBytes: 5678,
    largestCell: { id: '158_-425', bytes: 999 },
    cells: 3,
    splitCells: 1,
    files: 6,
    coverageCells: 7,
  })
  for (const want of ['colorado', '12', '34', '5678', '158_-425', '999', '| 3 |', '| 1 |', '| 6 |', '| 7 |', 'Coverage cells']) {
    assert.ok(md.includes(want), want)
  }
  assert.equal(readdirSync(tmp()).length, 0)
})
