// Requirements: "A failed or corrupt download publishes nothing new for the region" (its network
// scenarios fail on every attempt, change download-retries), "The data date is
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
// Downloads that are retried (change download-retries) wait through this instead of really waiting.
const noWait = { sleep: async () => {}, log: () => {} }

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

// Scenario "A request that fails before any response".
test('a request that fails before any response names the URL and its cause', async () => {
  const dir = tmp()
  const reset = async () => {
    const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
    throw new TypeError('fetch failed', { cause })
  }
  await assert.rejects(download('https://download.geofabrik.de/x.pbf', join(dir, 'a'), reset, noWait), (e) => {
    assert.match(e.message, /https:\/\/download\.geofabrik\.de\/x\.pbf/)
    assert.match(e.message, /ECONNRESET: read ECONNRESET/)
    return true
  })
  const noCode = async () => {
    throw new TypeError('fetch failed', { cause: new Error('getaddrinfo failed') })
  }
  await assert.rejects(download('https://download.geofabrik.de/x.pbf', join(dir, 'b'), noCode), (e) => {
    assert.match(e.message, /x\.pbf.*getaddrinfo failed/)
    assert.doesNotMatch(e.message, /undefined/)
    return true
  })
  const out = join(tmp(), 'out')
  let requests = 0
  const countedReset = async (...a) => {
    requests++
    return reset(...a)
  }
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: countedReset, ...noWait }), /colorado-latest\.osm\.pbf.*ECONNRESET: read ECONNRESET/)
  assert.equal(requests, 3)
  assert.equal(existsSync(out), false)
})

// Attack test (change download-cause-and-builder-heap): a cause can't start a workflow command on a
// new log line, and a cause that throws when read still leaves the URL in the error.
test('a hostile cause stays on one line and keeps the URL', async () => {
  const dir = tmp()
  const hostile = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'E\n::warning::y', message: 'x\r\n::add-mask::z' } })
  }
  await assert.rejects(download('https://download.geofabrik.de/x.pbf', join(dir, 'h'), hostile, noWait), (e) => {
    assert.doesNotMatch(e.message, /[\r\n]/)
    assert.match(e.message, /x\.pbf/)
    return true
  })
  const throwing = async () => {
    const cause = Object.defineProperty({}, 'message', { get() { throw new Error('boom') } })
    throw new TypeError('fetch failed', { cause })
  }
  await assert.rejects(download('https://download.geofabrik.de/x.pbf', join(dir, 't'), throwing), /x\.pbf.*fetch failed/)
})

// Scenario "A download cut off mid-stream".
test('a download cut off mid-stream names the URL and its cause, and writes nothing', async () => {
  const cutBody = () =>
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array([1, 2]))
        const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
        c.error(new TypeError('terminated', { cause }))
      },
    })
  const dir = tmp()
  await assert.rejects(
    download('https://download.geofabrik.de/x.poly', join(dir, 'c'), async () => new Response(cutBody()), noWait),
    /x\.poly.*terminated.*ECONNRESET: read ECONNRESET/,
  )
  const pbf = new Uint8Array([1, 2, 3])
  const md5 = createHash('md5').update(pbf).digest('hex')
  let polyRequests = 0
  const fake = async (url) => {
    if (url.endsWith('.poly')) polyRequests++
    return url.endsWith('.poly') ? new Response(cutBody()) : new Response(url.endsWith('.md5') ? `${md5}  colorado-latest.osm.pbf\n` : pbf)
  }
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: fake, ...noWait }), /colorado\.poly.*ECONNRESET: read ECONNRESET/)
  assert.equal(polyRequests, 3)
  assert.equal(existsSync(out), false)
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
