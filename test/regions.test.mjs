// Requirements: "The regions list", "A region's bounds lie inside its Geofabrik polygon".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateRegions, planOutput, REGION_ID } from '../src/regions.mjs'
import { parsePoly, rectInsidePoly } from '../src/poly.mjs'

const good = () => [
  {
    id: 'colorado',
    name: 'Colorado',
    geofabrik: 'north-america/us/colorado',
    bounds: { south: 37, west: -109.06, north: 41, east: -102.04 },
    clip: false,
  },
]

// Scenario "Colorado and Wyoming".
test('the repository\'s regions list is colorado then wyoming, and is valid', () => {
  const list = JSON.parse(readFileSync(new URL('../regions.json', import.meta.url)))
  validateRegions(list)
  assert.deepEqual(list.map((r) => r.id), ['colorado', 'wyoming'])
  assert.equal(planOutput(list), 'regions=["colorado","wyoming"]')
})

// Scenario "Colorado alone".
test('a list of colorado alone plans one region job', () => {
  assert.equal(planOutput(good()), 'regions=["colorado"]')
})

test('region ids', () => {
  assert.ok(REGION_ID.test('british-columbia'))
  assert.ok(!REGION_ID.test('../evil'))
  assert.ok(!REGION_ID.test(''))
  assert.ok(!REGION_ID.test('Colorado'))
})

test('a bad list fails naming the entry', () => {
  const bad = [
    ['an id that is a path', (l) => (l[0].id = '../evil'), /\.\.\/evil/],
    ['a duplicate id', (l) => l.push({ ...l[0] }), /colorado.*twice|duplicate/i],
    ['no name', (l) => delete l[0].name, /colorado/],
    ['a blank name', (l) => (l[0].name = '  '), /colorado/],
    ['an unknown bounds key', (l) => (l[0].bounds.up = 1), /colorado/],
    ['bounds as strings', (l) => (l[0].bounds.south = '37'), /colorado/],
    ['south above north', (l) => (l[0].bounds.south = 42), /colorado/],
    ['west above east', (l) => (l[0].bounds.west = -100), /colorado/],
    ['latitude out of range', (l) => (l[0].bounds.north = 91), /colorado/],
    ['a geofabrik path with ..', (l) => (l[0].geofabrik = 'north-america/../x'), /colorado/],
    ['a geofabrik URL', (l) => (l[0].geofabrik = 'https://evil.example/x'), /colorado/],
    ['clip not a boolean', (l) => (l[0].clip = 'yes'), /colorado/],
    ['an unknown key', (l) => (l[0].url = 'x'), /colorado/],
  ]
  for (const [what, mutate, msg] of bad) {
    const l = good()
    mutate(l)
    assert.throws(() => validateRegions(l), msg, what)
  }
  assert.throws(() => validateRegions({}), /array/)
  assert.throws(() => validateRegions([]), /empty|no region/i)
})

const square = `colorado
1
   -110.0   36.5
   -101.0   36.5
   -101.0   41.5
   -110.0   41.5
   -110.0   36.5
END
END
`

test('poly files are parsed into rings, holes marked', () => {
  const rings = parsePoly(`x
1
   1.0E+00   2.0E+00
   3   2
   3   4
END
!2
   1.5 2.5
   2 2.5
   2 3
END
END
`)
  assert.equal(rings.length, 2)
  assert.deepEqual(rings[0], { hole: false, points: [[1, 2], [3, 2], [3, 4]] })
  assert.equal(rings[1].hole, true)
  assert.throws(() => parsePoly('x\n1\n  a b\nEND\nEND\n'), /poly/i)
  assert.throws(() => parsePoly('x\n1\n 1 2\n'), /poly/i)
})

const co = { south: 37, west: -109.06, north: 41, east: -102.04 }

test('bounds inside, clear of every ring', () => {
  assert.equal(rectInsidePoly(co, parsePoly(square)), true)
})

test('a corner outside', () => {
  assert.equal(rectInsidePoly({ ...co, west: -111 }, parsePoly(square)), false)
})

test('a corner on a ring counts as outside', () => {
  assert.equal(rectInsidePoly({ ...co, north: 41.5 }, parsePoly(square)), false)
})

test('a notch cutting into the rectangle, with every corner inside', () => {
  const notched = `n
1
   -110 36.5
   -101 36.5
   -101 41.5
   -105.5 41.5
   -105.5 39
   -105.4 39
   -105.4 41.5
   -110 41.5
END
END
`
  assert.equal(rectInsidePoly(co, parsePoly(notched)), false)
})

test('a hole inside the rectangle', () => {
  const holed = square.replace(/END\nEND\n$/, 'END\n!h\n -105 39\n -104 39\n -104 40\n -105 40\nEND\nEND\n')
  assert.equal(rectInsidePoly(co, parsePoly(holed)), false)
})

test('the rectangle inside a second outer ring', () => {
  const two = `t
a
 0 0
 1 0
 1 1
 0 1
END
b
 -110 36.5
 -101 36.5
 -101 41.5
 -110 41.5
END
END
`
  assert.equal(rectInsidePoly(co, parsePoly(two)), true)
})

// Requirement: "The bounds guard names the first failing point".
import { polyFailure } from '../src/poly.mjs'

const sampleBounds = { south: 39, west: -108, north: 40, east: -105 }
const ring = (pts, hole = false) => ({ hole, points: pts })
const outer = ring([[-110, 36.5], [-101, 36.5], [-101, 41.5], [-110, 41.5]])

test('a corner outside is named first, south-west before the others', () => {
  // The polygon's west edge is at -107.5: the south-west and north-west corners are outside.
  const west = ring([[-107.5, 36.5], [-101, 36.5], [-101, 41.5], [-107.5, 41.5]])
  assert.equal(polyFailure(sampleBounds, [west]), 'south-west corner (39, -108) is outside the polygon')
  // Only the north-east corner outside.
  const ne = ring([[-110, 36.5], [-101, 36.5], [-101, 39.8], [-105.5, 39.8], [-105.5, 41.5], [-110, 41.5]])
  assert.equal(polyFailure(sampleBounds, [ne]), 'north-east corner (40, -105) is outside the polygon')
})

test('a corner on a ring\'s west or south edge counts as outside too', () => {
  // The ray test alone would call these corners inside; they lie on the ring.
  const westOn = ring([[-108, 36.5], [-101, 36.5], [-101, 41.5], [-108, 41.5]])
  assert.equal(polyFailure(sampleBounds, [westOn]), 'south-west corner (39, -108) is outside the polygon')
  const southOn = ring([[-110, 39], [-101, 39], [-101, 41.5], [-110, 41.5]])
  assert.equal(polyFailure(sampleBounds, [southOn]), 'south-west corner (39, -108) is outside the polygon')
})

test('points near zero are written as plain decimals', () => {
  const b = { south: -0.0000005, west: 1, north: 1, east: 2 }
  const r = ring([[1.5, 0], [3, 0], [3, 2], [1.5, 2]])
  assert.equal(polyFailure(b, [r]), 'south-west corner (-0.0000005, 1) is outside the polygon')
})

test('a corner on a ring counts as outside the polygon', () => {
  const onEdge = ring([[-110, 36.5], [-101, 36.5], [-101, 40], [-110, 40]])
  assert.equal(polyFailure(sampleBounds, [onEdge]), 'north-east corner (40, -105) is outside the polygon')
})

test('then a ring vertex inside the bounds, in .poly order', () => {
  const notched = ring([[-110, 36.5], [-101, 36.5], [-101, 41.5], [-105.5, 41.5], [-105.5, 39.5], [-105.6, 39.4], [-105.6, 41.5], [-110, 41.5]])
  assert.equal(polyFailure(sampleBounds, [notched]), 'ring vertex (39.5, -105.5) is inside the bounds')
  const holed = [outer, ring([[-106, 39.2], [-105.8, 39.2], [-105.8, 39.4]], true)]
  assert.equal(polyFailure(sampleBounds, holed), 'ring vertex (39.2, -106) is inside the bounds')
})

test('then a ring edge meeting the bounds, by its two ends', () => {
  const sliver = ring([[-106, 38], [-106.2, 41], [-106.1, 41.5]])
  assert.equal(polyFailure(sampleBounds, [outer, sliver]), 'ring edge from (38, -106) to (41, -106.2) meets the bounds')
})

test('bounds clear of every ring: no failure', () => {
  assert.equal(polyFailure(sampleBounds, [outer]), null)
  assert.equal(rectInsidePoly(sampleBounds, [outer]), true)
})

test('Colorado\'s proposed bounds (design open question 1)', () => {
  const list = JSON.parse(readFileSync(new URL('../regions.json', import.meta.url)))
  assert.deepEqual(list[0].bounds, { south: 37.01, west: -109.04, north: 40.99, east: -102.06 })
})

test('Wyoming\'s entry and proposed bounds (design open question 1)', () => {
  const list = JSON.parse(readFileSync(new URL('../regions.json', import.meta.url)))
  assert.deepEqual(list[1], {
    id: 'wyoming',
    name: 'Wyoming',
    geofabrik: 'north-america/us/wyoming',
    bounds: { south: 41.01, west: -111.04, north: 44.99, east: -104.06 },
    clip: false,
  })
})
