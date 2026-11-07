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

// Each corner inside the polygon (in an outer ring, in no hole), no ring edge touching or crossing
// the rectangle's edges, and no ring vertex inside it. A point on a ring counts as outside.
export function rectInsidePoly({ south, west, north, east }, rings) {
  const corners = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ]
  const rectEdges = edges(corners)
  for (const ring of rings) {
    for (const [a, b] of edges(ring.points)) {
      if (rectEdges.some(([c, d]) => segmentsMeet(a, b, c, d))) return false
    }
    for (const [x, y] of ring.points) {
      if (x > west && x < east && y > south && y < north) return false
    }
  }
  return corners.every(
    (c) => rings.some((r) => !r.hole && inRing(r.points, c)) && !rings.some((r) => r.hole && inRing(r.points, c)),
  )
}
