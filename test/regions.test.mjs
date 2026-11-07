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

test('the repository\'s regions list holds only colorado, and is valid', () => {
  const list = JSON.parse(readFileSync(new URL('../regions.json', import.meta.url)))
  validateRegions(list)
  assert.deepEqual(list.map((r) => r.id), ['colorado'])
  assert.equal(planOutput(list), 'regions=["colorado"]')
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
