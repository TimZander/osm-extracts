// OPL lines (from `osmium add-locations-to-ways -f opl,add_metadata=false`) to GeoJSON features.
// Spec: "Each feature's form", "Coordinates are rounded to six decimals".
import { categoriesFor } from './categories.mjs'

// OPL escapes characters in tag keys and values as %<hex codepoint>%.
function unescapeOpl(s) {
  return s.replace(/%([0-9a-fA-F]{1,6})%/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

function parseTags(field) {
  const tags = {}
  if (field === '') return tags
  for (const pair of field.split(',')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    tags[unescapeOpl(pair.slice(0, eq))] = unescapeOpl(pair.slice(eq + 1))
  }
  return tags
}

const WAY_NODE = /^n-?\d+(?:x(\S*)y(\S*))?$/

// One OPL line to { type: 'node', id, tags, lon, lat } or { type: 'way', id, tags, nodes }, where a
// way's node is { lon, lat } (strings as written) or null when its location is unknown. Anything
// else (relations, blank lines) is null.
export function parseOplLine(line) {
  const fields = line.trim().split(' ')
  const head = fields[0] ?? ''
  const kind = head[0]
  if (kind !== 'n' && kind !== 'w') return null
  const id = Number(head.slice(1))
  if (!Number.isSafeInteger(id)) return null
  let tags = {}
  let lon = ''
  let lat = ''
  let nodes = []
  for (const f of fields.slice(1)) {
    const v = f.slice(1)
    switch (f[0]) {
      case 'T':
        tags = parseTags(v)
        break
      case 'x':
        lon = v
        break
      case 'y':
        lat = v
        break
      case 'N':
        nodes =
          v === ''
            ? []
            : v.split(',').map((ref) => {
                const m = WAY_NODE.exec(ref)
                return m && m[1] && m[2] ? { lon: m[1], lat: m[2] } : null
              })
        break
    }
  }
  return kind === 'n' ? { type: 'node', id, tags, lon, lat } : { type: 'way', id, tags, nodes }
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/

// A decimal string rounded to six places, halves away from zero, done on the digits so a tie rounds
// the same everywhere. null when it isn't a plain decimal or exceeds ±limit.
export function roundCoord(s, limit) {
  const m = DECIMAL.exec(s)
  if (!m) return null
  const [, sign, int, frac = ''] = m
  const digits = (frac + '0000000').slice(0, 7)
  let micro = Number(int) * 1e6 + Number(digits.slice(0, 6))
  if (digits[6] >= '5') micro += 1
  if (!Number.isSafeInteger(micro)) return null
  const value = micro / 1e6
  if (value > limit) return null
  return sign === '-' && micro !== 0 ? -value : value
}

function locate(lon, lat) {
  const x = roundCoord(lon, 180)
  const y = roundCoord(lat, 90)
  return x === null || y === null ? null : [x, y]
}

function inside(clip, [lon, lat]) {
  return lat >= clip.south && lat <= clip.north && lon >= clip.west && lon <= clip.east
}

// The feature for a parsed OPL element, or null when it matches no category, has too few located
// vertices, or (with `clip`, a clipped region's bounds) is a point outside the bounds.
export function featureFromOpl(el, { clip } = {}) {
  if (!el) return null
  const cats = categoriesFor(el.type, el.tags)
  if (cats.length === 0) return null
  const properties = { title: el.tags.name ?? '', _osmCategories: cats, _osmId: `${el.type}/${el.id}` }
  if (el.type === 'node') {
    const at = locate(el.lon, el.lat)
    if (!at || (clip && !inside(clip, at))) return null
    return { type: 'Feature', geometry: { type: 'Point', coordinates: at }, properties }
  }
  const coords = []
  for (const n of el.nodes) {
    const at = n && locate(n.lon, n.lat)
    if (at) coords.push(at)
  }
  if (coords.length < 2) return null
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties }
}
