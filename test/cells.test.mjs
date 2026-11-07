// Requirements: "Features are filed into 0.25° cells", "A dense cell is split into its four
// quarters", "The output is byte-stable", "The manifest lists exactly the files written", "No
// published file is over 20 MiB", "Each region job reports its size".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SPLIT_THRESHOLD,
  MAX_FILE_BYTES,
  cellId,
  quarterId,
  compareCellIds,
  compareFeatures,
  serializeFeature,
  collectionText,
  buildCells,
} from '../src/cells.mjs'

const point = (id, lon, lat, cats = ['peaks'], title = '') => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { title, _osmCategories: cats, _osmId: `node/${id}` },
})
const line = (id, coords) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coords },
  properties: { title: '', _osmCategories: ['trails'], _osmId: `way/${id}` },
})
const parse = (text) => JSON.parse(text)

test('the limits', () => {
  assert.equal(SPLIT_THRESHOLD, 4 * 1024 * 1024)
  assert.equal(MAX_FILE_BYTES, 20 * 1024 * 1024)
})

test('cell and quarter ids', () => {
  assert.equal(cellId(-106.062, 39.625), '158_-425')
  assert.equal(quarterId(-106.062, 39.603), '316_-849')
  assert.equal(cellId(0.1, -0.1), '-1_0')
  assert.equal(cellId(-0.0, 0), '0_0')
  assert.equal(cellId(-106, 39.75), '159_-424')
})

test('cell ids sort numerically by row, then column', () => {
  const ids = ['159_-425', '158_-424', '158_-425', '-1_3']
  assert.deepEqual(ids.sort(compareCellIds), ['-1_3', '158_-425', '158_-424', '159_-425'])
})

test('features sort nodes before ways, each by numeric id', () => {
  const fs = [line(5, [[0, 0], [1, 1]]), point(20, 0, 0), point(3, 0, 0)]
  assert.deepEqual(
    fs.sort(compareFeatures).map((f) => f.properties._osmId),
    ['node/3', 'node/20', 'way/5'],
  )
})

test('a feature is written with fixed key order on one line', () => {
  const f = point(101, -106.062, 39.625, ['peaks'], 'Example Peak')
  // Keys given out of order must still come out in the fixed order.
  const shuffled = {
    properties: { _osmId: 'node/101', title: 'Example Peak', _osmCategories: ['peaks'] },
    geometry: { coordinates: [-106.062, 39.625], type: 'Point' },
    type: 'Feature',
  }
  const want =
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[-106.062,39.625]},"properties":{"title":"Example Peak","_osmCategories":["peaks"],"_osmId":"node/101"}}'
  assert.equal(serializeFeature(f), want)
  assert.equal(serializeFeature(shuffled), want)
})

test('collection text: one feature per line, final newline; empty collection', () => {
  assert.equal(collectionText([]), '{"type":"FeatureCollection","features":[]}\n')
  assert.equal(collectionText(['{"a":1}', '{"b":2}']), '{"type":"FeatureCollection","features":[\n{"a":1},\n{"b":2}\n]}\n')
})

test('a point goes in its cell; empty cells are not written', () => {
  const r = buildCells('colorado', [point(101, -106.062, 39.625)])
  assert.deepEqual([...r.files.keys()], ['colorado/158_-425.json'])
  assert.deepEqual(r.cells, ['158_-425'])
  assert.deepEqual(r.split, [])
  const fc = parse(r.files.get('colorado/158_-425.json'))
  assert.equal(fc.type, 'FeatureCollection')
  assert.equal(fc.features[0].properties._osmId, 'node/101')
})

test('a trail across a cell edge is written whole into both cells', () => {
  const t = line(202, [
    [-106.1, 39.6],
    [-105.9, 39.6],
  ])
  const r = buildCells('colorado', [t])
  assert.deepEqual(r.cells, ['158_-425', '158_-424'])
  for (const id of r.cells) {
    assert.deepEqual(parse(r.files.get(`colorado/${id}.json`)).features[0].geometry.coordinates, t.geometry.coordinates)
  }
})

test('a cell over the threshold is written as four quarters, empty ones included', () => {
  // Two features in quarter 316_-849, one in 316_-850, a trail spanning 316_-849 and 317_-849.
  const fs = [
    point(1, -106.062, 39.603),
    point(2, -106.07, 39.61),
    point(3, -106.2, 39.55),
    line(4, [
      [-106.05, 39.6],
      [-106.05, 39.7],
    ]),
    point(5, -105.9, 39.6), // cell 158_-424, stays whole
  ]
  const r = buildCells('colorado', fs, { threshold: 200 })
  assert.deepEqual(r.cells, ['158_-425', '158_-424'])
  assert.deepEqual(r.split, ['158_-425'])
  assert.ok(!r.files.has('colorado/158_-425.json'))
  const ids = (p) => parse(r.files.get(p)).features.map((f) => f.properties._osmId)
  assert.deepEqual(ids('colorado/158_-425/316_-850.json'), ['node/3'])
  assert.deepEqual(ids('colorado/158_-425/316_-849.json'), ['node/1', 'node/2', 'way/4'])
  assert.deepEqual(ids('colorado/158_-425/317_-850.json'), [])
  assert.deepEqual(ids('colorado/158_-425/317_-849.json'), ['way/4'])
  assert.equal(r.files.get('colorado/158_-425/317_-850.json'), '{"type":"FeatureCollection","features":[]}\n')
  assert.ok(r.files.has('colorado/158_-424.json'))
  assert.equal(r.files.size, 5)
})

test('a cell exactly at the threshold is written whole', () => {
  const one = buildCells('colorado', [point(1, -106.062, 39.603)])
  const size = Buffer.byteLength(one.files.get('colorado/158_-425.json'))
  assert.deepEqual(buildCells('colorado', [point(1, -106.062, 39.603)], { threshold: size }).split, [])
  assert.deepEqual(buildCells('colorado', [point(1, -106.062, 39.603)], { threshold: size - 1 }).split, ['158_-425'])
})

test('a quarter of a split cell holds only vertices of that cell', () => {
  // A trail with a vertex in 158_-425 (quarter 316_-849) and one in 158_-424 (quarter 316_-848).
  const t = line(9, [
    [-106.01, 39.6],
    [-105.99, 39.6],
  ])
  const r = buildCells('colorado', [t], { threshold: 10 })
  assert.deepEqual(r.split, ['158_-425', '158_-424'])
  assert.deepEqual([...r.files.keys()].sort(), [
    'colorado/158_-424/316_-848.json',
    'colorado/158_-424/316_-847.json',
    'colorado/158_-424/317_-848.json',
    'colorado/158_-424/317_-847.json',
    'colorado/158_-425/316_-850.json',
    'colorado/158_-425/316_-849.json',
    'colorado/158_-425/317_-850.json',
    'colorado/158_-425/317_-849.json',
  ].sort())
  assert.equal(parse(r.files.get('colorado/158_-424/316_-848.json')).features.length, 1)
  assert.equal(parse(r.files.get('colorado/158_-424/316_-847.json')).features.length, 0)
})

test('the same data built twice is byte-identical, whatever the input order', () => {
  const fs = [point(20, -106.06, 39.6), line(5, [[-106.06, 39.6], [-106.0, 39.61]]), point(3, -106.06, 39.6)]
  const a = buildCells('colorado', fs)
  const b = buildCells('colorado', [...fs].reverse())
  assert.deepEqual([...a.files.entries()], [...b.files.entries()])
  assert.deepEqual(
    parse(a.files.get('colorado/158_-425.json')).features.map((f) => f.properties._osmId),
    ['node/3', 'node/20', 'way/5'],
  )
})

test('a feature listed twice (same _osmId) is written once', () => {
  const r = buildCells('colorado', [point(1, -106.06, 39.6), point(1, -106.06, 39.6)])
  assert.equal(parse(r.files.get('colorado/158_-425.json')).features.length, 1)
})

test('a file over 20 MiB fails, naming the file and its size', () => {
  const big = point(1, -106.062, 39.603, ['peaks'], 'x'.repeat(300))
  const size = Buffer.byteLength(buildCells('colorado', [big]).files.get('colorado/158_-425.json'))
  assert.throws(
    () => buildCells('colorado', [big], { maxFile: size - 1 }),
    (e) => e.message.includes('colorado/158_-425.json') && e.message.includes(String(size)),
  )
  // A quarter over the limit fails too.
  assert.throws(
    () => buildCells('colorado', [big], { threshold: 10, maxFile: size - 1 }),
    /colorado\/158_-425\/316_-849\.json/,
  )
})

test('the size report', () => {
  const fs = [point(1, -106.062, 39.603), point(2, -105.9, 39.6), line(3, [[-106.1, 39.6], [-105.9, 39.6]])]
  const r = buildCells('colorado', fs, { threshold: 300 })
  const bytes = [...r.files.values()].reduce((n, t) => n + Buffer.byteLength(t), 0)
  assert.equal(r.stats.nodes, 2)
  assert.equal(r.stats.ways, 1)
  assert.equal(r.stats.totalBytes, bytes)
  assert.equal(r.stats.cells, 2)
  assert.equal(r.stats.splitCells, r.split.length)
  assert.equal(r.stats.files, r.files.size)
  assert.ok(['158_-425', '158_-424'].includes(r.stats.largestCell.id))
  assert.ok(r.stats.largestCell.bytes > 0)
})
