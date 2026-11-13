// A region job: download (or take local files), check, filter with osmium, build the region's cells,
// and write its tree, manifest entry and size report to an output folder for the deploy job.
//
//   node src/build-region.mjs <region-id> --out <dir> [--pbf <file> --md5 <file> --poly <file>]
//
// Spec: "A failed or corrupt download publishes nothing new for the region", "The data date is the
// source's replication time", "A region's bounds lie inside its Geofabrik polygon", "A clipped
// region is cut to its bounds", "No published file is over 20 MiB", "Each region job reports its
// size", "Each region lists the cells it covers", "A clipped region covers its bounds' cells", "A download
// is retried after a network failure". osmium is run with execFile, never a shell.
import { createReadStream, createWriteStream, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { loadRegions, validateRegions, REGION_ID } from './regions.mjs'
import { parsePoly, polyFailure, coveredCells, rectCells } from './poly.mjs'
import { osmiumFilters } from './categories.mjs'
import { parseOplLine, featureFromOpl } from './features.mjs'
import { buildCells, SPLIT_THRESHOLD, MAX_FILE_BYTES } from './cells.mjs'

const run = promisify(execFile)

if (Number(process.versions.node.split('.')[0]) < 20) {
  throw new Error(`Node 20 or later is needed; this is ${process.versions.node}`)
}

export function sourceUrls(path) {
  const base = `https://download.geofabrik.de/${path}`
  return { pbf: `${base}-latest.osm.pbf`, md5: `${base}-latest.osm.pbf.md5`, poly: `${base}.poly` }
}

// Spec: "A download is retried after a network failure", "Network-level download failures", "Each
// failed download attempt is logged on one line". Three attempts; the waits before the second and the
// third (ADR 0037).
export const RETRY_WAITS_MS = [30_000, 120_000]
const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET',
  'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
  'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN',
])
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitText = (ms) => (ms % 60_000 === 0 ? `${ms / 60_000} min` : `${ms / 1000} s`)

// One attempt. Throws an Error whose message is the failure's text (ADR 0031), whose `reason` is the
// attempt's cause for its log line (its HTTP status, else its underlying error's code and message,
// else its own message), and whose `retry` says whether it failed at the network level.
async function downloadOnce(url, dest, fetchImpl) {
  let res
  try {
    res = await fetchImpl(url, { redirect: 'follow' })
  } catch (e) {
    throw failure(`download of ${url} failed: ${e.message}${causeText(e.cause)}`, causeReason(e), isNetworkCause(e.cause))
  }
  if (!res.ok || !res.body) {
    throw failure(`download of ${url} failed: HTTP ${res.status}`, `HTTP ${res.status}`, res.status >= 500 || res.status === 429)
  }
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  } catch (e) {
    throw failure(`download of ${url} failed while reading the body: ${e.message}${causeText(e.cause)}`, causeReason(e), isNetworkCause(e.cause))
  }
}

function failure(message, reason, retry) {
  return Object.assign(new Error(oneLine(message)), { reason: oneLine(reason), retry })
}

// The underlying error's "CODE: message" (as causeText writes it), or the error's own message when
// there is no underlying error.
function causeReason(e) {
  const c = causeText(e?.cause)
  if (c) return c.slice(' (cause: '.length, -1)
  try {
    return String(e?.message)
  } catch {
    return 'unreadable error'
  }
}

function isNetworkCause(cause) {
  try {
    return typeof cause?.code === 'string' && NETWORK_CODES.has(cause.code)
  } catch {
    return false
  }
}

export async function download(url, dest, fetchImpl = fetch, { sleep = defaultSleep, log = console.log } = {}) {
  const attempts = RETRY_WAITS_MS.length + 1
  for (let n = 1; ; n++) {
    try {
      await downloadOnce(url, dest, fetchImpl)
      return
    } catch (e) {
      const wait = e.retry && n < attempts ? RETRY_WAITS_MS[n - 1] : null
      log(oneLine(`Download attempt ${n} of ${attempts} for ${url} failed: ${e.reason}; ${wait === null ? 'giving up' : `retrying in ${waitText(wait)}`}`))
      if (wait === null) throw new Error(e.message)
      await sleep(wait)
    }
  }
}

// U+0000–U+001F and U+007F become a space, so no text from the network can start a log line.
function oneLine(text) {
  return String(text).replace(/[\u0000-\u001f\u007f]+/g, ' ')
}

// The underlying error Node's fetch keeps in `cause`, as " (cause: CODE: message)", or "" with none.
// Kept on one line (no control characters), so it can't start a workflow command in the job log, and
// a cause that can't be read leaves the rest of the error intact.
function causeText(cause) {
  if (!cause) return ''
  try {
    const message = cause.message ?? String(cause)
    const text = `${cause.code ? `${cause.code}: ` : ''}${message}`.replace(/[\u0000-\u001f\u007f]+/g, ' ')
    return ` (cause: ${text})`
  } catch {
    return ' (cause: unreadable)'
  }
}

export function checkMd5(file, md5Text) {
  const want = /^([0-9a-f]{32})\b/i.exec(md5Text.trim())?.[1]?.toLowerCase()
  if (!want) throw new Error('the .md5 file holds no MD5 checksum')
  const got = createHash('md5').update(readFileSync(file)).digest('hex')
  if (got !== want) throw new Error(`MD5 mismatch: the download is ${got}, Geofabrik's .md5 says ${want}`)
}

export function dataDateFrom(timestamp) {
  const t = timestamp.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(t) || Number.isNaN(Date.parse(t))) {
    throw new Error(`the PBF header has no usable replication timestamp, osmosis_replication_timestamp (got "${t}")`)
  }
  return t.slice(0, 10)
}

export function summaryMarkdown(id, s) {
  return [
    `### Region ${id}`,
    '',
    '| Matching nodes | Matching ways | Total bytes | Largest 0.25° cell (before splitting) | Cells | Split cells | Files | Coverage cells |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    `| ${s.nodes} | ${s.ways} | ${s.totalBytes} | ${s.largestCell.id} (${s.largestCell.bytes} bytes) | ${s.cells} | ${s.splitCells} | ${s.files} | ${s.coverageCells} |`,
    '',
  ].join('\n')
}

async function readFeatures(oplFile, clip) {
  const features = []
  const lines = createInterface({ input: createReadStream(oplFile), crlfDelay: Infinity })
  for await (const line of lines) {
    const f = featureFromOpl(parseOplLine(line), { clip })
    if (f) features.push(f)
  }
  return features
}

// Builds one region into `out` (which must not exist yet; it is created only on success).
export async function buildRegion({
  id,
  out,
  regions = loadRegions(),
  local = null,
  fetchImpl = fetch,
  osmium = 'osmium',
  threshold = SPLIT_THRESHOLD,
  maxFile = MAX_FILE_BYTES,
  log = console.log,
  sleep = defaultSleep,
}) {
  validateRegions(regions)
  if (typeof id !== 'string' || !REGION_ID.test(id)) throw new Error(`"${id}" is not a region id`)
  const region = regions.find((r) => r.id === id)
  if (!region) throw new Error(`region ${id} is not in regions.json`)
  if (existsSync(out)) throw new Error(`${out} already exists`)

  const work = mkdtempSync(join(tmpdir(), `osm-${id}-`))
  try {
    let src
    if (local) {
      src = local
    } else {
      const urls = sourceUrls(region.geofabrik)
      src = { pbf: join(work, 'source.osm.pbf'), md5: join(work, 'source.md5'), poly: join(work, 'source.poly') }
      for (const k of ['pbf', 'md5', 'poly']) {
        log(`Downloading ${urls[k]}`)
        await download(urls[k], src[k], fetchImpl, { sleep, log })
      }
    }
    checkMd5(src.pbf, readFileSync(src.md5, 'utf8'))
    const rings = parsePoly(readFileSync(src.poly, 'utf8'))
    const failure = polyFailure(region.bounds, rings)
    if (failure) throw new Error(`region ${id}: its bounds reach outside its Geofabrik polygon: ${failure}`)
    const { stdout: ts } = await run(osmium, ['fileinfo', '-g', 'header.option.osmosis_replication_timestamp', src.pbf])
    const dataDate = dataDateFrom(ts)

    let input = src.pbf
    const b = region.bounds
    if (region.clip) {
      const clipped = join(work, 'clipped.osm.pbf')
      await run(osmium, ['extract', '--bbox', `${b.west},${b.south},${b.east},${b.north}`, '--strategy', 'complete_ways', '-o', clipped, input])
      input = clipped
    }
    const filtered = join(work, 'filtered.osm.pbf')
    await run(osmium, ['tags-filter', '-o', filtered, input, ...osmiumFilters()])
    const opl = join(work, 'located.opl')
    await run(osmium, ['add-locations-to-ways', '--ignore-missing-nodes', '-f', 'opl,add_metadata=false', '-o', opl, filtered])

    const features = await readFeatures(opl, region.clip ? b : undefined)
    const built = buildCells(id, features, { threshold, maxFile })
    // A clipped region's data stops at its bounds; an unclipped one's at its polygon.
    const coverage = region.clip ? rectCells(b) : coveredCells(rings)
    const stats = { ...built.stats, coverageCells: coverage.length }

    const staging = join(work, 'out')
    for (const [path, text] of built.files) {
      const file = join(staging, path)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, text)
    }
    const entry = { id, name: region.name, bounds: { south: b.south, west: b.west, north: b.north, east: b.east }, dataDate, cells: built.cells, split: built.split, coverage }
    writeFileSync(join(staging, 'entry.json'), JSON.stringify(entry, null, 2) + '\n')
    writeFileSync(join(staging, 'stats.json'), JSON.stringify({ id, dataDate, ...stats }, null, 2) + '\n')
    mkdirSync(dirname(resolve(out)), { recursive: true })
    renameSync(staging, out)

    const md = summaryMarkdown(id, stats)
    log(md)
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n')
    return { entry, stats }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function parseArgs(argv) {
  const [id, ...rest] = argv
  const opts = {}
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i]
    const v = rest[i + 1]
    if (!['--out', '--pbf', '--md5', '--poly'].includes(k) || v === undefined) throw new Error(`bad argument ${k}`)
    opts[k.slice(2)] = v
  }
  if (!opts.out) throw new Error('--out is required')
  const localKeys = ['pbf', 'md5', 'poly'].filter((k) => opts[k])
  if (localKeys.length !== 0 && localKeys.length !== 3) throw new Error('--pbf, --md5 and --poly go together')
  return { id, out: opts.out, local: localKeys.length ? { pbf: opts.pbf, md5: opts.md5, poly: opts.poly } : null }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await buildRegion(parseArgs(process.argv.slice(2)))
  } catch (e) {
    console.error(`::error::${e.message}`)
    process.exit(1)
  }
}
