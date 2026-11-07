// The cell writer: files a region's features into 0.25° cells, splits dense cells into 0.125°
// quarters, and writes byte-stable FeatureCollections. Spec: "Features are filed into 0.25° cells",
// "A dense cell is split into its four quarters", "The output is byte-stable".

// Open question 1 in the design: 4 MiB until the first Colorado run measures it.
export const SPLIT_THRESHOLD = 4 * 1024 * 1024
export const MAX_FILE_BYTES = 20 * 1024 * 1024

// `${-0}` is "0", so no id is written as "-0".
const pair = (a, b) => `${a}_${b}`

export function cellId(lon, lat) {
  return pair(Math.floor(lat * 4), Math.floor(lon * 4))
}

export function quarterId(lon, lat) {
  return pair(Math.floor(lat * 8), Math.floor(lon * 8))
}

function parseId(id) {
  const [r, c] = id.split('_')
  return [Number(r), Number(c)]
}

export function compareCellIds(a, b) {
  const [ar, ac] = parseId(a)
  const [br, bc] = parseId(b)
  return ar - br || ac - bc
}

function osmKey(f) {
  const [type, id] = f.properties._osmId.split('/')
  return [type === 'node' ? 0 : 1, Number(id)]
}

export function compareFeatures(a, b) {
  const [at, ai] = osmKey(a)
  const [bt, bi] = osmKey(b)
  return at - bt || ai - bi
}

// Fixed key order, whatever order the object was built in.
export function serializeFeature(f) {
  const g = f.geometry
  const p = f.properties
  return JSON.stringify({
    type: 'Feature',
    geometry: { type: g.type, coordinates: g.coordinates },
    properties: { title: p.title, _osmCategories: p._osmCategories, _osmId: p._osmId },
  })
}

export function collectionText(lines) {
  if (lines.length === 0) return '{"type":"FeatureCollection","features":[]}\n'
  return `{"type":"FeatureCollection","features":[\n${lines.join(',\n')}\n]}\n`
}

function vertices(f) {
  return f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates
}

function bytes(text) {
  return Buffer.byteLength(text, 'utf8')
}

// Build a region's files. Returns { files: Map<path, text> in write order, cells, split, stats }.
// Throws when any file exceeds `maxFile`, naming the file and its size.
export function buildCells(region, features, { threshold = SPLIT_THRESHOLD, maxFile = MAX_FILE_BYTES } = {}) {
  const sorted = [...features].sort(compareFeatures)
  const unique = []
  for (const f of sorted) {
    if (unique.length && unique.at(-1).properties._osmId === f.properties._osmId) continue
    unique.push(f)
  }

  // cell id -> indexes of its features, in sorted order.
  const byCell = new Map()
  const lines = unique.map(serializeFeature)
  unique.forEach((f, i) => {
    const seen = new Set()
    for (const [lon, lat] of vertices(f)) {
      const id = cellId(lon, lat)
      if (seen.has(id)) continue
      seen.add(id)
      if (!byCell.has(id)) byCell.set(id, [])
      byCell.get(id).push(i)
    }
  })

  const cells = [...byCell.keys()].sort(compareCellIds)
  const files = new Map()
  const split = []
  let largestCell = { id: null, bytes: 0 }
  for (const id of cells) {
    const members = byCell.get(id)
    const whole = collectionText(members.map((i) => lines[i]))
    const size = bytes(whole)
    if (size > largestCell.bytes) largestCell = { id, bytes: size }
    if (size <= threshold) {
      files.set(`${region}/${id}.json`, whole)
      continue
    }
    split.push(id)
    const [row, col] = parseId(id)
    const quarters = new Map()
    for (const qr of [2 * row, 2 * row + 1]) {
      for (const qc of [2 * col, 2 * col + 1]) quarters.set(pair(qr, qc), [])
    }
    for (const i of members) {
      const seen = new Set()
      for (const [lon, lat] of vertices(unique[i])) {
        if (cellId(lon, lat) !== id) continue
        const q = quarterId(lon, lat)
        if (seen.has(q)) continue
        seen.add(q)
        quarters.get(q).push(i)
      }
    }
    for (const [q, qMembers] of quarters) {
      files.set(`${region}/${id}/${q}.json`, collectionText(qMembers.map((i) => lines[i])))
    }
  }

  let totalBytes = 0
  for (const [path, text] of files) {
    const size = bytes(text)
    if (size > maxFile) {
      throw new Error(`${path} is ${size} bytes, over the ${maxFile}-byte limit per file`)
    }
    totalBytes += size
  }

  const nodes = unique.filter((f) => f.geometry.type === 'Point').length
  return {
    files,
    cells,
    split,
    stats: {
      nodes,
      ways: unique.length - nodes,
      totalBytes,
      largestCell,
      cells: cells.length,
      splitCells: split.length,
      files: files.size,
    },
  }
}
