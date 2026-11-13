// Requirements: "A download is retried after a network failure", "Network-level download failures",
// "Each failed download attempt is logged on one line" (change download-retries). Fake fetches and a
// fake sleep that records its waits, so no test really waits; one test drives the default sleep with
// node:test's mock timers.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { download, buildRegion } from '../src/build-region.mjs'

const tmp = () => mkdtempSync(join(tmpdir(), 'osm-retry-'))
const URL_PBF = 'https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf'
const URL_MD5 = 'https://download.geofabrik.de/north-america/us/colorado-latest.osm.pbf.md5'
const URL_POLY = 'https://download.geofabrik.de/north-america/us/colorado.poly'

function fakeSleep() {
  const waits = []
  return { waits, sleep: async (ms) => void waits.push(ms) }
}
function logger() {
  const lines = []
  return { lines, log: (l) => void lines.push(String(l)) }
}
const noResponse = (code, message = `${code} happened`) => async () => {
  const cause = code === undefined ? new Error(message) : Object.assign(new Error(message), { code })
  throw new TypeError('fetch failed', { cause })
}
// A body that sends some bytes, which reach the file, and then fails with an underlying error.
const cutBody = (code) => () => {
  let pulls = 0
  return new Response(
    new ReadableStream({
      async pull(c) {
        pulls++
        if (pulls === 1) return c.enqueue(new TextEncoder().encode('PARTIAL-'))
        await new Promise((r) => setTimeout(r, 20))
        c.error(new TypeError('terminated', { cause: Object.assign(new Error(`${code} mid-body`), { code }) }))
      },
    }),
  )
}
// A fetch that answers each URL from its own list of steps, the last step repeating; counts requests.
function scripted(steps) {
  const count = {}
  const f = async (url) => {
    count[url] = (count[url] ?? 0) + 1
    const list = steps[url]
    const step = list[Math.min(count[url], list.length) - 1]
    return typeof step === 'function' ? step() : new Response(step)
  }
  return { f, count }
}
const status = (s) => () => new Response('x', { status: s })

// Files for Colorado whose polygon holds its bounds, so a build gets past the guard to osmium.
const PBF = new Uint8Array([1, 2, 3, 4])
const MD5 = `${createHash('md5').update(PBF).digest('hex')}  colorado-latest.osm.pbf\n`
const POLY = 'colorado\n1\n-110 36\n-101 36\n-101 42\n-110 42\nEND\nEND\n'
const NO_OSMIUM = join(tmpdir(), 'no-such-osmium-binary')
// The build reaches osmium only when every download has succeeded and the MD5 and bounds checks pass.
const reachedOsmium = (e) => /ENOENT|no-such-osmium-binary/.test(e.message)

// --- "A download is retried after a network failure" ---

test('a refused connection, then a good download: built from the second, after 30 s', async () => {
  const dir = tmp()
  const { f, count } = scripted({ [URL_PBF]: [noResponse('ECONNREFUSED', 'connect ECONNREFUSED'), () => new Response('good')] })
  const { sleep, waits } = fakeSleep()
  await download(URL_PBF, join(dir, 'p'), f, { sleep, log: () => {} })
  assert.equal(readFileSync(join(dir, 'p'), 'utf8'), 'good')
  assert.equal(count[URL_PBF], 2)
  assert.deepEqual(waits, [30_000])

  const all = scripted({ [URL_PBF]: [noResponse('ECONNREFUSED'), () => new Response(PBF)], [URL_MD5]: [MD5], [URL_POLY]: [POLY] })
  const s2 = fakeSleep()
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: all.f, sleep: s2.sleep, log: () => {}, osmium: NO_OSMIUM }), reachedOsmium)
  assert.equal(all.count[URL_PBF], 2)
  assert.deepEqual(s2.waits, [30_000])
})

test('a server error on every attempt: 3 requests, waits of 30 s then 2 min, the job fails', async () => {
  const { f, count } = scripted({ [URL_PBF]: [PBF], [URL_MD5]: [status(503)], [URL_POLY]: [POLY] })
  const { sleep, waits } = fakeSleep()
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: f, sleep, log: () => {}, osmium: NO_OSMIUM }), /pbf\.md5.*503/)
  assert.equal(count[URL_MD5], 3)
  assert.deepEqual(waits, [30_000, 120_000])
  assert.equal(existsSync(out), false)
})

test('too many requests: a 429 is retried', async () => {
  const dir = tmp()
  const { f, count } = scripted({ [URL_POLY]: [status(429), () => new Response('poly')] })
  const { sleep, waits } = fakeSleep()
  await download(URL_POLY, join(dir, 'p'), f, { sleep, log: () => {} })
  assert.equal(readFileSync(join(dir, 'p'), 'utf8'), 'poly')
  assert.equal(count[URL_POLY], 2)
  assert.deepEqual(waits, [30_000])
})

test('a 5xx, then a 429, then success', async () => {
  const dir = tmp()
  const { f, count } = scripted({ [URL_PBF]: [status(502), status(429), () => new Response('third')] })
  const { sleep, waits } = fakeSleep()
  await download(URL_PBF, join(dir, 'p'), f, { sleep, log: () => {} })
  assert.equal(readFileSync(join(dir, 'p'), 'utf8'), 'third')
  assert.equal(count[URL_PBF], 3)
  assert.deepEqual(waits, [30_000, 120_000])
})

test('a body cut off, then whole: the file is the whole second body, not a splice', async () => {
  const dir = tmp()
  const dest = join(dir, 'p')
  let partial = null
  // Before the second response, the cut-off first body's bytes are on disk, so the test can tell a
  // retry that starts the file again from one that appends to it.
  const second = () => {
    partial = readFileSync(dest, 'utf8')
    return new Response(POLY)
  }
  const { f, count } = scripted({ [URL_POLY]: [cutBody('ECONNRESET'), second] })
  const { sleep, waits } = fakeSleep()
  await download(URL_POLY, dest, f, { sleep, log: () => {} })
  assert.equal(partial, 'PARTIAL-')
  assert.equal(readFileSync(dest, 'utf8'), POLY)
  assert.equal(count[URL_POLY], 2)
  assert.deepEqual(waits, [30_000])

  const all = scripted({ [URL_PBF]: [PBF], [URL_MD5]: [MD5], [URL_POLY]: [cutBody('ECONNRESET'), () => new Response(POLY)] })
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: all.f, sleep: fakeSleep().sleep, log: () => {}, osmium: NO_OSMIUM }), reachedOsmium)
})

test('each file has its own attempts', async () => {
  const all = scripted({
    [URL_PBF]: [status(503), status(503), () => new Response(PBF)],
    [URL_MD5]: [MD5],
    [URL_POLY]: [status(503), status(503), () => new Response(POLY)],
  })
  const { sleep, waits } = fakeSleep()
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: all.f, sleep, log: () => {}, osmium: NO_OSMIUM }), reachedOsmium)
  assert.equal(all.count[URL_PBF], 3)
  assert.equal(all.count[URL_POLY], 3)
  assert.deepEqual(waits, [30_000, 120_000, 30_000, 120_000])
})

test('a missing file is not retried', async () => {
  const { f, count } = scripted({ [URL_PBF]: [PBF], [URL_MD5]: [status(404)], [URL_POLY]: [POLY] })
  const { sleep, waits } = fakeSleep()
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: f, sleep, log: () => {} }), /404/)
  assert.equal(count[URL_MD5], 1)
  assert.deepEqual(waits, [])
  for (const s of [400, 403, 410]) {
    const one = scripted({ [URL_MD5]: [status(s)] })
    await assert.rejects(download(URL_MD5, join(tmp(), 'm'), one.f, { sleep, log: () => {} }), new RegExp(String(s)))
    assert.equal(one.count[URL_MD5], 1)
  }
  assert.deepEqual(waits, [])
})

test('a corrupt download is not retried', async () => {
  const bad = `${'0'.repeat(32)}  colorado-latest.osm.pbf\n`
  const { f, count } = scripted({ [URL_PBF]: [PBF], [URL_MD5]: [bad], [URL_POLY]: [POLY] })
  const { sleep, waits } = fakeSleep()
  const lg = logger()
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: f, sleep, log: lg.log }), /MD5/)
  assert.deepEqual(count, { [URL_PBF]: 1, [URL_MD5]: 1, [URL_POLY]: 1 })
  assert.deepEqual(waits, [])
  // An MD5 mismatch is not a download attempt, so it has no attempt log line.
  assert.equal(lg.lines.filter((l) => /attempt/.test(l)).length, 0)
})

// --- "Network-level download failures" ---

test('a body that stops sending (UND_ERR_BODY_TIMEOUT) is retried', async () => {
  const dir = tmp()
  const { f, count } = scripted({ [URL_PBF]: [cutBody('UND_ERR_BODY_TIMEOUT'), () => new Response('whole')] })
  await download(URL_PBF, join(dir, 'p'), f, { sleep: fakeSleep().sleep, log: () => {} })
  assert.equal(readFileSync(join(dir, 'p'), 'utf8'), 'whole')
  assert.equal(count[URL_PBF], 2)
})

test('every listed code is network-level, before a response and mid-body', async () => {
  const codes = ['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN']
  for (const code of codes) {
    for (const first of [noResponse(code), cutBody(code)]) {
      const { f, count } = scripted({ [URL_PBF]: [first, () => new Response('ok')] })
      await download(URL_PBF, join(tmp(), 'p'), f, { sleep: fakeSleep().sleep, log: () => {} })
      assert.equal(count[URL_PBF], 2, code)
    }
  }
  for (const s of [500, 502, 503, 504, 429]) {
    const { f, count } = scripted({ [URL_PBF]: [status(s), () => new Response('ok')] })
    await download(URL_PBF, join(tmp(), 'p'), f, { sleep: fakeSleep().sleep, log: () => {} })
    assert.equal(count[URL_PBF], 2, String(s))
  }
})

test('a DNS lookup that failed for now (EAI_AGAIN) is retried: built from the second, after 30 s', async () => {
  const all = scripted({ [URL_PBF]: [noResponse('EAI_AGAIN', 'getaddrinfo EAI_AGAIN download.geofabrik.de'), () => new Response(PBF)], [URL_MD5]: [MD5], [URL_POLY]: [POLY] })
  const { sleep, waits } = fakeSleep()
  const out = join(tmp(), 'out')
  await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: all.f, sleep, log: () => {}, osmium: NO_OSMIUM }), reachedOsmium)
  assert.equal(all.count[URL_PBF], 2)
  assert.deepEqual(waits, [30_000])
})

for (const [name, code] of [
  ['an unknown host', 'ENOTFOUND'],
  ['a TLS error', 'CERT_HAS_EXPIRED'],
  ['an underlying error with no code', undefined],
]) {
  test(`${name} is not retried`, async () => {
    const { f, count } = scripted({ [URL_PBF]: [noResponse(code, 'nope')] })
    const { sleep, waits } = fakeSleep()
    const out = join(tmp(), 'out')
    await assert.rejects(buildRegion({ id: 'colorado', out, fetchImpl: f, sleep, log: () => {} }), /colorado-latest\.osm\.pbf/)
    assert.equal(count[URL_PBF], 1)
    assert.deepEqual(waits, [])
    assert.equal(existsSync(out), false)
  })
}

test('a fetch error with no underlying error is not retried', async () => {
  const { f, count } = scripted({ [URL_PBF]: [async () => { throw new TypeError('fetch failed') }] })
  await assert.rejects(download(URL_PBF, join(tmp(), 'p'), f, { sleep: fakeSleep().sleep, log: () => {} }), /fetch failed/)
  assert.equal(count[URL_PBF], 1)
})

// --- "Each failed download attempt is logged on one line" ---

test('a retried attempt is logged with URL, attempt 1 of 3, cause and the wait', async () => {
  const { f } = scripted({ [URL_PBF]: [noResponse('ECONNREFUSED', 'connect ECONNREFUSED'), () => new Response('ok')] })
  const lg = logger()
  await download(URL_PBF, join(tmp(), 'p'), f, { sleep: fakeSleep().sleep, log: lg.log })
  assert.deepEqual(lg.lines, [`Download attempt 1 of 3 for ${URL_PBF} failed: ECONNREFUSED: connect ECONNREFUSED; retrying in 30 s`])
})

test('an attempt whose error has no underlying error logs its own message', async () => {
  const { f } = scripted({ [URL_PBF]: [async () => { throw new TypeError('fetch failed') }] })
  const lg = logger()
  await assert.rejects(download(URL_PBF, join(tmp(), 'p'), f, { sleep: fakeSleep().sleep, log: lg.log }))
  assert.deepEqual(lg.lines, [`Download attempt 1 of 3 for ${URL_PBF} failed: fetch failed; giving up`])
})

test('the last attempt is logged with "giving up", and the second with a wait of 2 min', async () => {
  const { f } = scripted({ [URL_MD5]: [status(503)] })
  const lg = logger()
  await assert.rejects(download(URL_MD5, join(tmp(), 'm'), f, { sleep: fakeSleep().sleep, log: lg.log }), /503/)
  assert.deepEqual(lg.lines, [
    `Download attempt 1 of 3 for ${URL_MD5} failed: HTTP 503; retrying in 30 s`,
    `Download attempt 2 of 3 for ${URL_MD5} failed: HTTP 503; retrying in 2 min`,
    `Download attempt 3 of 3 for ${URL_MD5} failed: HTTP 503; giving up`,
  ])
})

test('a 404 is the last attempt: one line, attempt 1 of 3, HTTP 404, giving up', async () => {
  const { f } = scripted({ [URL_MD5]: [status(404)] })
  const lg = logger()
  await assert.rejects(download(URL_MD5, join(tmp(), 'm'), f, { sleep: fakeSleep().sleep, log: lg.log }), /404/)
  assert.deepEqual(lg.lines, [`Download attempt 1 of 3 for ${URL_MD5} failed: HTTP 404; giving up`])
})

// Attack test: a cause carrying CR, LF and a workflow command can't start a new log line.
test('a hostile cause keeps every attempt log line on one line, with none starting with ::', async () => {
  const hostile = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET\n::warning::x', message: 'a\r\n::add-mask::y\u007f\u0000' } })
  }
  const hostileReset = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET', message: 'a\r\n::warning::y\n::error::z' } })
  }
  // No underlying error: only the error's own message carries the attack.
  const ownMessage = async () => {
    throw new TypeError('fetch failed\r\n::warning::own\n::error::x\u0000')
  }
  const { f } = scripted({ [URL_PBF]: [hostileReset, hostile] })
  const lg = logger()
  await assert.rejects(download(URL_PBF, join(tmp(), 'p'), f, { sleep: fakeSleep().sleep, log: lg.log }))
  const own = scripted({ [URL_PBF]: [ownMessage] })
  await assert.rejects(download(URL_PBF, join(tmp(), 'q'), own.f, { sleep: fakeSleep().sleep, log: lg.log }), (e) => {
    assert.doesNotMatch(e.message, /[\u0000-\u001f\u007f]/)
    return true
  })
  assert.equal(lg.lines.length, 3)
  for (const l of lg.lines) {
    assert.doesNotMatch(l, /[\u0000-\u001f\u007f]/)
    for (const piece of l.split(/\r?\n/)) assert.doesNotMatch(piece, /^::/)
  }
})

// The default sleep really waits: the second request isn't made until 30 s have passed.
test('the default sleep waits 30 s before the second attempt', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { f, count } = scripted({ [URL_PBF]: [noResponse('ECONNRESET'), () => new Response('ok')] })
    const p = download(URL_PBF, join(tmp(), 'p'), f, { log: () => {} })
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))
    assert.equal(count[URL_PBF], 1)
    mock.timers.tick(29_999)
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))
    assert.equal(count[URL_PBF], 1)
    mock.timers.tick(1)
    await p
    assert.equal(count[URL_PBF], 2)
  } finally {
    mock.timers.reset()
  }
})
