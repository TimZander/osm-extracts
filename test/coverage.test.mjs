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
