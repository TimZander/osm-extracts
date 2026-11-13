// Requirements: "Each region lists the cells it covers", "A clipped region covers its bounds' cells",
// "The output is byte-stable" (coverage sorted, each id once).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coveredCells, rectCells } from '../src/poly.mjs'
import { compareCellIds } from '../src/cells.mjs'

const ring = (points, hole = false) => ({ hole, points })
const rect = (south, west, north, east) => [[west, south], [east, south], [east, north], [west, north]]
const grid = (rows, cols) => rows.flatMap((r) => cols.map((c) => `${r}_${c}`))
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

test('a polygon on cell lines covers exactly its 144 cells', () => {
  const got = coveredCells([ring(rect(38.5, -107.5, 41.5, -104.5))])
  assert.equal(got.length, 144)
  assert.deepEqual(got, grid(range(154, 165), range(-430, -419)))
})

test('a covered cell is listed whatever the features', () => {
  assert.ok(coveredCells([ring(rect(39.9, -105.1, 40.4, -104.9))]).includes('160_-420'))
})

test('a polygon that cuts through a cell covers it', () => {
  // A sliver 0.001° tall along the south edge of 164_-425 (41.0 to 41.25, -106.25 to -106.0).
  const got = coveredCells([ring(rect(40.9, -106.2, 41.001, -106.1))])
  assert.deepEqual(got, ['163_-425', '164_-425'])
})

test('a polygon that meets a cell only along its edge does not cover it', () => {
  const got = coveredCells([ring(rect(40.6, -106.2, 41.0, -105.6))])
  assert.ok(got.length > 0)
  assert.ok(got.every((id) => !id.startsWith('164_')), got.join(','))
  // A slanted edge that touches 41.0 at one vertex only.
  const tri = coveredCells([ring([[-106.2, 40.8], [-106.1, 41.0], [-106.0, 40.8]])])
  assert.ok(tri.every((id) => !id.startsWith('164_')), tri.join(','))
})

test('a polygon that meets a cell only at a corner does not cover it', () => {
  assert.deepEqual(coveredCells([ring(rect(40.0, -105.0, 40.25, -104.75))]), ['160_-420'])
})

test('a hole that holds a whole cell takes it out; a partial hole does not', () => {
  const outer = ring(rect(39.5, -105.5, 40.5, -104.5))
  const whole = coveredCells([outer, ring(rect(40.0, -105.0, 40.25, -104.75), true)])
  assert.ok(!whole.includes('160_-420'))
  assert.equal(whole.length, 16 - 1)
  const partial = coveredCells([outer, ring(rect(40.05, -104.95, 40.2, -104.8), true)])
  assert.ok(partial.includes('160_-420'))
})

test('two outer rings, and a polygon in the southern and eastern hemispheres', () => {
  const got = coveredCells([ring(rect(0.1, 0.1, 0.2, 0.2)), ring(rect(-0.2, -0.2, -0.1, -0.1))])
  assert.deepEqual(got, ['-1_-1', '0_0'])
})

test('under 1e-12 square degrees is rounding, not coverage', () => {
  // 1e-7 × 1e-7 = 1e-14 square degrees inside 164_-425.
  assert.deepEqual(coveredCells([ring(rect(40.9, -106.2, 41.0000001, -106.1999999))]).filter((id) => id.startsWith('164_')), [])
})

test('output is sorted by row, then column, each id once', () => {
  const got = coveredCells([ring([[-106.3, 39.4], [-105.2, 39.45], [-105.4, 40.3], [-106.1, 40.1]])])
  assert.deepEqual(got, [...got].sort(compareCellIds))
  assert.equal(new Set(got).size, got.length)
})

test('a clipped region covers the cells its bounds share area with', () => {
  assert.deepEqual(rectCells({ south: 39.1, west: -105.6, north: 39.5, east: -105.0 }), grid([156, 157], [-423, -422, -421]))
})

// Contacts inside the polygon's bounding box, so the area rule, not the box, keeps the cells out.
test('a notch whose edges lie on cell lines leaves the notch cell out', () => {
  const l = [[-106.0, 40.0], [-105.5, 40.0], [-105.5, 40.25], [-105.75, 40.25], [-105.75, 40.5], [-106.0, 40.5]]
  assert.deepEqual(coveredCells([ring(l)]), ['160_-424', '160_-423', '161_-424'])
})

test('two rings meeting only at a cell corner leave the cells between them out', () => {
  const got = coveredCells([ring(rect(40.0, -105.0, 40.25, -104.75)), ring(rect(40.25, -104.75, 40.5, -104.5))])
  assert.deepEqual(got, ['160_-420', '161_-419'])
})

// "Each region lists the cells it covers": coverage comes from each region's own polygon alone, so
// two neighbours whose polygons meet on a line inside a cell column (-109.05, the Colorado–Utah line,
// lies in column -437) both list that column's cells along the line.
test('neighbours meeting on -109.05 both cover the column -437 cells', () => {
  const west = coveredCells([ring(rect(37.0, -110.0, 38.0, -109.05))])
  const east = coveredCells([ring(rect(37.0, -109.05, 38.0, -108.0))])
  const line = grid(range(148, 151), [-437])
  for (const c of line) {
    assert.ok(west.includes(c), `west ${c}`)
    assert.ok(east.includes(c), `east ${c}`)
  }
  assert.ok(!west.includes('148_-436'))
  assert.ok(!east.includes('148_-438'))
})

// "Each region lists the cells it covers", at Idaho's borders (idaho-region design decisions 4, 5).
// -111.05, the Idaho–Wyoming line, lies inside column -445 (-111.25 to -111.0), so both sides list
// that column's cells along it.
test('neighbours meeting on -111.05 both cover the column -445 cells', () => {
  const west = coveredCells([ring(rect(42.0, -112.0, 44.0, -111.05))])
  const east = coveredCells([ring(rect(42.0, -111.05, 44.0, -110.0))])
  for (const c of grid(range(168, 175), [-445])) {
    assert.ok(west.includes(c), `west ${c}`)
    assert.ok(east.includes(c), `east ${c}`)
  }
  assert.ok(!west.includes('168_-444'))
  assert.ok(!east.includes('168_-446'))
})

// 42° N, the Idaho–Utah line, is a cell line (row 167 below, 168 above): polygons ending on it list
// only their own row, and polygons reaching past it by a margin both list both rows.
test('neighbours on 42 N share rows 167 and 168 only where their polygons cross the line', () => {
  const cols = range(-456, -447)
  const south = (n) => coveredCells([ring(rect(41.0, -114.0, n, -111.5))])
  const north = (s) => coveredCells([ring(rect(s, -114.0, 43.0, -111.5))])
  for (const c of grid([168], cols)) assert.ok(!south(42.0).includes(c), `on the line, south ${c}`)
  for (const c of grid([167], cols)) assert.ok(!north(42.0).includes(c), `on the line, north ${c}`)
  for (const c of grid([167, 168], cols)) {
    assert.ok(south(42.01).includes(c), `margin, south ${c}`)
    assert.ok(north(41.99).includes(c), `margin, north ${c}`)
  }
})

// A panhandle: a wide south and a strip 1° wide to 49° N. The strip's cells are covered; the cells
// east of it, inside the bounding box but outside the polygon, are not.
test('a panhandle-shaped polygon covers its strip and nothing east of it', () => {
  const pan = [[-117.0, 46.0], [-113.0, 46.0], [-113.0, 47.0], [-116.0, 47.0], [-116.0, 49.0], [-117.0, 49.0]]
  const got = coveredCells([ring(pan)])
  for (const c of grid(range(188, 195), range(-468, -465))) assert.ok(got.includes(c), `strip ${c}`)
  for (const c of grid(range(188, 195), range(-464, -453))) assert.ok(!got.includes(c), `east ${c}`)
  assert.equal(got.length, 4 * 16 + 4 * 8)
})
