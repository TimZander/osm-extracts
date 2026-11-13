// Geofabrik .poly files, and whether a region's bounds lie wholly inside one.
// Spec: "A region's bounds lie inside its Geofabrik polygon".

// Rings of [lon, lat] points; a ring whose header starts with "!" is a hole.
export function parsePoly(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const rings = []
  let i = 1 // line 0 is the polygon's name
  for (;;) {
    const header = lines[i++]
    if (header === undefined) throw new Error('poly file ends before its final END')
    if (header === 'END') break
    if (header === '') continue
    const ring = { hole: header.startsWith('!'), points: [] }
    for (;;) {
      const l = lines[i++]
      if (l === undefined) throw new Error('poly file ends inside a ring')
      if (l === 'END') break
      const parts = l.split(/\s+/)
      const lon = Number(parts[0])
      const lat = Number(parts[1])
      if (parts.length !== 2 || !Number.isFinite(lon) || !Number.isFinite(lat)) {
        throw new Error(`poly file has a bad coordinate line: "${l}"`)
      }
      ring.points.push([lon, lat])
    }
    // Drop a repeated closing point; edges wrap around anyway.
    const p = ring.points
    if (p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop()
    if (p.length < 3) throw new Error('poly file has a ring with fewer than three points')
    rings.push(ring)
  }
  if (rings.length === 0) throw new Error('poly file has no ring')
  return rings
}

function edges(points) {
  return points.map((p, i) => [p, points[(i + 1) % points.length]])
}

function orient(a, b, c) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  return v > 0 ? 1 : v < 0 ? -1 : 0
}

function onSegment(a, b, p) {
  return (
    orient(a, b, p) === 0 &&
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  )
}

// True when the segments touch or cross, collinear overlaps included.
function segmentsMeet(p1, p2, q1, q2) {
  const o1 = orient(p1, p2, q1)
  const o2 = orient(p1, p2, q2)
  const o3 = orient(q1, q2, p1)
  const o4 = orient(q1, q2, p2)
  if (o1 !== o2 && o3 !== o4) return true
  return onSegment(p1, p2, q1) || onSegment(p1, p2, q2) || onSegment(q1, q2, p1) || onSegment(q1, q2, p2)
}

// Even-odd ray test; callers rule out points on an edge first.
function inRing(points, [x, y]) {
  let inside = false
  for (const [[x1, y1], [x2, y2]] of edges(points)) {
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}

// The shortest decimal that reads back as the value, never in exponent notation (1e-7).
const num = (n) => {
  const s = String(n)
  return /e/i.test(s) ? n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 }) : s
}
const pt = ([lon, lat]) => `(${num(lat)}, ${num(lon)})`

// The first reason the rectangle isn't wholly inside the polygon, or null when it is (spec: "The
// bounds guard names the first failing point"). Order: corners south-west, south-east, north-east,
// north-west, outside or on a ring; then a ring vertex inside the rectangle; then a ring edge meeting
// the rectangle's edges. Rings and points in .poly order. Points are written (lat, lon).
export function polyFailure({ south, west, north, east }, rings) {
  const corners = [
    ['south-west', [west, south]],
    ['south-east', [east, south]],
    ['north-east', [east, north]],
    ['north-west', [west, north]],
  ]
  for (const [name, c] of corners) {
    const onRing = rings.some((r) => edges(r.points).some(([a, b]) => onSegment(a, b, c)))
    const inside = rings.some((r) => !r.hole && inRing(r.points, c)) && !rings.some((r) => r.hole && inRing(r.points, c))
    if (onRing || !inside) return `${name} corner ${pt(c)} is outside the polygon`
  }
  for (const ring of rings) {
    for (const p of ring.points) {
      if (p[0] > west && p[0] < east && p[1] > south && p[1] < north) return `ring vertex ${pt(p)} is inside the bounds`
    }
  }
  const rectEdges = edges(corners.map(([, c]) => c))
  for (const ring of rings) {
    for (const [a, b] of edges(ring.points)) {
      if (rectEdges.some(([c, d]) => segmentsMeet(a, b, c, d))) return `ring edge from ${pt(a)} to ${pt(b)} meets the bounds`
    }
  }
  return null
}

// True when the bounds lie wholly inside the polygon (spec: "A region's bounds lie inside its
// Geofabrik polygon").
export function rectInsidePoly(bounds, rings) {
  return polyFailure(bounds, rings) === null
}

// Coverage (spec: "Each region lists the cells it covers", "A clipped region covers its bounds'
// cells"): the 0.25° cells whose square shares more than MIN_COVER_AREA square degrees with the
// polygon's inside, outer rings added and holes taken away. A polygon meeting a cell only along an
// edge or at a corner shares no area with it.
export const MIN_COVER_AREA = 1e-12

// Sutherland–Hodgman: the ring clipped to one half-plane, kept where keep(p) holds; cut(a, b) is
// where edge a→b crosses the line, with the line's own coordinate set exactly.
function clipHalf(points, keep, cut) {
  const out = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const ka = keep(a)
    const kb = keep(b)
    if (ka) out.push(a)
    if (ka !== kb) out.push(cut(a, b))
  }
  return out
}

const atX = (x) => (a, b) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])]
const atY = (y) => (a, b) => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y]

// The area of the ring inside the square [x0, x1] × [y0, y1].
function areaInBox(points, x0, y0, x1, y1) {
  let p = points
  p = clipHalf(p, (q) => q[0] >= x0, atX(x0))
  if (p.length < 3) return 0
  p = clipHalf(p, (q) => q[0] <= x1, atX(x1))
  if (p.length < 3) return 0
  p = clipHalf(p, (q) => q[1] >= y0, atY(y0))
  if (p.length < 3) return 0
  p = clipHalf(p, (q) => q[1] <= y1, atY(y1))
  if (p.length < 3) return 0
  // Shoelace from the first point, so a ring flat along a cell line comes out exactly 0.
  const [ox, oy] = p[0]
  let twice = 0
  for (let i = 1; i < p.length - 1; i++) {
    twice += (p[i][0] - ox) * (p[i + 1][1] - oy) - (p[i + 1][0] - ox) * (p[i][1] - oy)
  }
  return Math.abs(twice) / 2
}

// Cell ids, sorted by row then column, each once. `${-0}` is "0", so no id is written as "-0".
export function coveredCells(rings) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rings) {
    if (r.hole) continue
    for (const [x, y] of r.points) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  const ids = []
  if (minX === Infinity) return ids
  for (let row = Math.floor(minY * 4); row < Math.ceil(maxY * 4); row++) {
    for (let col = Math.floor(minX * 4); col < Math.ceil(maxX * 4); col++) {
      const box = [col / 4, row / 4, (col + 1) / 4, (row + 1) / 4]
      let area = 0
      for (const r of rings) area += (r.hole ? -1 : 1) * areaInBox(r.points, ...box)
      if (area > MIN_COVER_AREA) ids.push(`${row}_${col}`)
    }
  }
  return ids
}

// A clipped region's coverage: the cells its bounds rectangle shares area with.
export function rectCells({ south, west, north, east }) {
  return coveredCells([{ hole: false, points: [[west, south], [east, south], [east, north], [west, north]] }])
}
