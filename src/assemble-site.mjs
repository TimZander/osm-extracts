// The deploy job's assembler: reads the previous data tree and this run's region artifacts, checks
// them, and writes the whole new site (region files, manifest.json, _headers, 404.html, LICENSE.txt).
//
//   node src/assemble-site.mjs --previous <dir> --artifacts <dir> --out <dir>
//
// Spec: "The manifest describes every region", "The site holds at most 19,000 files", "The deploy
// job accepts only well-formed region trees", "A failed region keeps its previous files", "The
// previous site is read from the data branch", "The site holds only the extract's files", "Files
// dropped from the manifest stay one more run", "The site sets its CORS and cache headers", "A
// missing file is a real 404", "The extract carries its licence notice".
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES_FROM } from './categories.mjs'
import { MAX_FILE_BYTES, compareCellIds } from './cells.mjs'
import { loadRegions, validateRegions, REGION_ID } from './regions.mjs'

export const MAX_SITE_FILES = 19000
export const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'
export const REPOSITORY_URL = 'https://github.com/TimZander/osm-extracts'

// Pages joins the values of a header set by two matching rules, so Cache-Control is set by rules
// that never overlap; CORS is on every path.
export const HEADERS = `/*
  Access-Control-Allow-Origin: *

/:region/*
  Cache-Control: public, max-age=3600

/LICENSE.txt
  Cache-Control: public, max-age=3600

/manifest.json
  Cache-Control: public, max-age=300
`

export const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Not found</title></head>
<body><p>Not found. This site holds an OpenStreetMap extract; see <a href="/manifest.json">manifest.json</a>.</p></body>
</html>
`

const SITE_FILES = ['manifest.json', '_headers', '404.html', 'LICENSE.txt']
const CELL_ID = /^(0|-?[1-9]\d*)_(0|-?[1-9]\d*)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const BOUND_KEYS = ['south', 'west', 'north', 'east']

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function checkRegionEntry(r, { strict }) {
  if (!isObject(r)) throw new Error('a region is not an object')
  if (typeof r.id !== 'string' || !REGION_ID.test(r.id)) throw new Error(`region id ${JSON.stringify(r.id)} is not valid`)
  const where = `region ${r.id}`
  if (typeof r.name !== 'string') throw new Error(`${where}: name is not a string`)
  if (!isObject(r.bounds) || !BOUND_KEYS.every((k) => typeof r.bounds[k] === 'number' && Number.isFinite(r.bounds[k]))) {
    throw new Error(`${where}: bounds must have numeric south, west, north and east`)
  }
  if (typeof r.dataDate !== 'string' || !DATE.test(r.dataDate) || Number.isNaN(Date.parse(r.dataDate))) {
    throw new Error(`${where}: dataDate must be YYYY-MM-DD`)
  }
  if (!Array.isArray(r.cells) || !r.cells.every((c) => typeof c === 'string' && CELL_ID.test(c))) {
    throw new Error(`${where}: cells must be an array of cell ids`)
  }
  if (r.split !== undefined && (!Array.isArray(r.split) || !r.split.every((c) => typeof c === 'string' && CELL_ID.test(c)))) {
    throw new Error(`${where}: split must be an array of cell ids`)
  }
  if (strict) {
    if (new Set(r.cells).size !== r.cells.length) throw new Error(`${where}: cells has a duplicate`)
    if (!Array.isArray(r.split)) throw new Error(`${where}: split is missing`)
    if (new Set(r.split).size !== r.split.length) throw new Error(`${where}: split has a duplicate`)
    const cells = new Set(r.cells)
    if (!r.split.every((c) => cells.has(c))) throw new Error(`${where}: split lists a cell that cells doesn't`)
  }
}

// The manifest form garmin-map's osm-import reads (extra keys allowed).
export function validateManifest(m) {
  if (!isObject(m)) throw new Error('the manifest is not an object')
  if (typeof m.attribution !== 'string') throw new Error('the manifest has no attribution string')
  if (!Array.isArray(m.regions)) throw new Error('the manifest has no regions array')
  for (const r of m.regions) checkRegionEntry(r, { strict: false })
  return m
}

function quarters(id) {
  const [row, col] = id.split('_').map(Number)
  return [
    [2 * row, 2 * col],
    [2 * row, 2 * col + 1],
    [2 * row + 1, 2 * col],
    [2 * row + 1, 2 * col + 1],
  ].map(([r, c]) => `${r}_${c}`)
}

// The files a manifest entry lists: a whole cell's file, or a split cell's four quarters. A split id
// the cells don't list is ignored, as the consumer does.
export function cellFiles(regionId, entry) {
  const split = new Set(entry.split ?? [])
  return entry.cells.flatMap((c) => (split.has(c) ? quarters(c).map((q) => `${regionId}/${c}/${q}.json`) : [`${regionId}/${c}.json`]))
}

function normalEntry(r) {
  return {
    id: r.id,
    name: r.name,
    bounds: { south: r.bounds.south, west: r.bounds.west, north: r.bounds.north, east: r.bounds.east },
    dataDate: r.dataDate,
    cells: [...r.cells].sort(compareCellIds),
    split: [...(r.split ?? [])].filter((c) => r.cells.includes(c)).sort(compareCellIds),
  }
}

function regularFile(path) {
  try {
    return lstatSync(path).isFile()
  } catch {
    return false
  }
}

// The previous tree comes from the data branch; a symbolic link in it (which this pipeline never
// writes) could point a read outside the tree, so any one fails the run.
function rejectSymlinks(dir, rel = '') {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = rel ? `${rel}/${e.name}` : e.name
    if (e.isSymbolicLink()) throw new Error(`the previous data tree holds a symbolic link, ${path}`)
    if (e.isDirectory()) rejectSymlinks(join(dir, e.name), path)
  }
}

function readPrevious(previousDir) {
  rejectSymlinks(previousDir)
  const file = join(previousDir, 'manifest.json')
  if (!existsSync(file)) return []
  let m
  try {
    m = validateManifest(JSON.parse(readFileSync(file, 'utf8')))
  } catch (e) {
    throw new Error(`the previous manifest on the data branch is not valid: ${e.message}`)
  }
  for (const r of m.regions) {
    for (const p of cellFiles(r.id, r)) {
      if (!regularFile(join(previousDir, p))) throw new Error(`the previous manifest lists ${p}, which the previous tree doesn't hold`)
    }
  }
  return m.regions
}

// Every regular file under dir, as paths relative to base; anything that isn't a file or a folder fails.
function walk(dir, base, label) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    const rel = `${base}/${e.name}`
    if (e.isDirectory()) out.push(...walk(p, rel, label))
    else if (e.isFile()) out.push(rel)
    else throw new Error(`${label}: ${rel} is not a regular file`)
  }
  return out
}

function readArtifact(root, region, maxFile) {
  const label = `the artifact for region ${region.id}`
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const ok = (e.isFile() && (e.name === 'entry.json' || e.name === 'stats.json')) || (e.isDirectory() && e.name === region.id)
    if (!ok) throw new Error(`${label} holds ${e.name}, which doesn't belong in it`)
  }
  let entry
  try {
    entry = JSON.parse(readFileSync(join(root, 'entry.json'), 'utf8'))
    checkRegionEntry(entry, { strict: true })
  } catch (e) {
    throw new Error(`${label}: its entry.json is not valid: ${e.message}`)
  }
  if (entry.id !== region.id || entry.name !== region.name || !BOUND_KEYS.every((k) => entry.bounds[k] === region.bounds[k])) {
    throw new Error(`${label}: its id, name or bounds differ from regions.json`)
  }
  const want = cellFiles(region.id, entry)
  const regionDir = join(root, region.id)
  const have = existsSync(regionDir) ? walk(regionDir, region.id, label) : []
  const wantSet = new Set(want)
  const extra = have.filter((p) => !wantSet.has(p))
  const haveSet = new Set(have)
  const missing = want.filter((p) => !haveSet.has(p))
  if (extra.length) throw new Error(`${label} holds files its entry doesn't list: ${extra.slice(0, 5).join(', ')}`)
  if (missing.length) throw new Error(`${label} lacks files its entry lists: ${missing.slice(0, 5).join(', ')}`)
  for (const p of want) {
    const size = lstatSync(join(root, p)).size
    if (size > maxFile) throw new Error(`${label}: ${p} is ${size} bytes, over the ${maxFile}-byte limit per file`)
  }
  return normalEntry(entry)
}

export function licenseText(entries, regions) {
  const byId = new Map(regions.map((r) => [r.id, r]))
  const lines = entries.map((e) => `- ${e.name}: data of ${e.dataDate}, from https://download.geofabrik.de/${byId.get(e.id).geofabrik}-latest.osm.pbf`)
  return `OpenStreetMap extract: licence

The data on this site is © OpenStreetMap contributors and is available under the Open Database
License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/

These files are a derived database, offered under the ODbL 1.0. They were derived from Geofabrik's
downloads of OpenStreetMap data (https://download.geofabrik.de/):

${lines.join('\n')}

The derivation (the code that selects, converts and grids the data) is public at
${REPOSITORY_URL}
`
}

export function assembleSite({
  regions = loadRegions(),
  previousDir,
  artifactsDir,
  outDir,
  categoriesFrom = CATEGORIES_FROM,
  maxFiles = MAX_SITE_FILES,
  maxFile = MAX_FILE_BYTES,
  log = console.log,
}) {
  validateRegions(regions)
  if (existsSync(outDir)) throw new Error(`${outDir} already exists`)
  const listed = new Map(regions.map((r) => [r.id, r]))

  const previous = readPrevious(previousDir)
  const previousById = new Map(previous.map((r) => [r.id, r]))

  // This run's artifacts, each region-<id> for a listed region. A region job uploads its files in a
  // region-<id> folder. download-artifact puts a lone artifact straight into artifactsDir, which
  // leaves artifactsDir/region-<id>/{entry.json,...}; two or more go each into a folder named for
  // the artifact, which leaves artifactsDir/region-<id>/region-<id>/{entry.json,...}.
  const artifacts = new Map()
  const found = existsSync(artifactsDir) ? readdirSync(artifactsDir, { withFileTypes: true }) : []
  for (const e of found) {
    const id = /^region-([a-z0-9-]+)$/.exec(e.name)?.[1]
    if (!e.isDirectory() || !id) throw new Error(`the artifacts hold ${e.name}, which is not a region artifact`)
    const region = listed.get(id)
    if (!region) throw new Error(`the artifacts hold region ${id}, which is not in regions.json`)
    let root = join(artifactsDir, e.name)
    if (found.length > 1) {
      const inner = readdirSync(root, { withFileTypes: true })
      if (inner.length !== 1 || !inner[0].isDirectory() || inner[0].name !== e.name) {
        throw new Error(`the artifact for region ${id} doesn't hold exactly one folder ${e.name}`)
      }
      root = join(root, e.name)
    }
    artifacts.set(id, { root, entry: readArtifact(root, region, maxFile) })
  }

  const plan = new Map() // site path -> source file
  const entries = []
  for (const region of regions) {
    if (artifacts.has(region.id)) {
      const { root, entry } = artifacts.get(region.id)
      entries.push(entry)
      for (const p of cellFiles(region.id, entry)) plan.set(p, join(root, p))
      log(`${region.id}: this run's build, data of ${entry.dataDate}`)
    } else if (previousById.has(region.id)) {
      const entry = normalEntry(previousById.get(region.id))
      entries.push(entry)
      for (const p of cellFiles(region.id, entry)) plan.set(p, join(previousDir, p))
      log(`${region.id}: no build this run; keeping the previous one, data of ${entry.dataDate}`)
    } else {
      log(`${region.id}: no build this run and none before; left out`)
    }
  }
  let carried = 0
  for (const r of previous) {
    for (const p of cellFiles(r.id, r)) {
      if (!plan.has(p)) {
        plan.set(p, join(previousDir, p))
        carried++
      }
    }
  }
  log(`${carried} file(s) dropped from the manifest are kept for one more run`)

  const total = plan.size + SITE_FILES.length
  const perRegion = new Map()
  for (const p of plan.keys()) {
    const id = p.split('/')[0]
    perRegion.set(id, (perRegion.get(id) ?? 0) + 1)
  }
  const counts = [...perRegion].map(([id, n]) => `${id}: ${n}`).join(', ')
  if (total > maxFiles) throw new Error(`the site would hold ${total} files, over the ${maxFiles}-file limit (${counts})`)
  log(`the site holds ${total} files (${counts})`)

  const manifest = { attribution: ATTRIBUTION, categoriesFrom, regions: entries }
  validateManifest(manifest)
  mkdirSync(outDir, { recursive: true })
  for (const [p, src] of plan) {
    mkdirSync(dirname(join(outDir, p)), { recursive: true })
    copyFileSync(src, join(outDir, p))
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  writeFileSync(join(outDir, '_headers'), HEADERS)
  writeFileSync(join(outDir, '404.html'), NOT_FOUND_HTML)
  writeFileSync(join(outDir, 'LICENSE.txt'), licenseText(entries, regions))
  return { manifest, total, perRegion }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const opt = (k) => {
    const i = args.indexOf(k)
    if (i < 0 || !args[i + 1]) throw new Error(`${k} is required`)
    return args[i + 1]
  }
  try {
    const { total, perRegion } = assembleSite({ previousDir: opt('--previous'), artifactsDir: opt('--artifacts'), outDir: opt('--out') })
    if (process.env.GITHUB_STEP_SUMMARY) {
      const rows = [...perRegion].map(([id, n]) => `| ${id} | ${n} |`).join('\n')
      writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Site\n\n${total} files.\n\n| Region | Files |\n| --- | --- |\n${rows}\n`, { flag: 'a' })
    }
  } catch (e) {
    console.error(`::error::${e.message}`)
    process.exit(1)
  }
}
