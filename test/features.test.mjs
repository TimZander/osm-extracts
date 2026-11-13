// Requirements: "The import's categories", "The extract holds exactly what the import's categories
// select", "Each feature's form", "The category rules name the garmin-map commit they were copied
// from", "Coordinates are rounded to six decimals", "A clipped region is cut to its bounds", "Which
// ways are forest roads", "How a tag value has a phrase as words".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, CATEGORIES_FROM, categoriesFor, hasWords, osmiumFilters } from '../src/categories.mjs'
import { parseOplLine, roundCoord, featureFromOpl } from '../src/features.mjs'

test('the categories are garmin-map\'s, in catalog order', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => [c.id, c.element]),
    [
      ['peaks', 'node'],
      ['passes', 'node'],
      ['huts', 'node'],
      ['hot_springs', 'node'],
      ['trailheads', 'node'],
      ['parking', 'node'],
      ['forest_roads', 'way'],
      ['trails', 'way'],
      ['ridges', 'way'],
    ],
  )
  assert.match(CATEGORIES_FROM, /^[0-9a-f]{40}$/)
  assert.equal(CATEGORIES_FROM, '755fe009346756284afcb7c187e9465236c7de0d')
})

test('a value has a phrase as words', () => {
  const K = '\u212A' // the Kelvin sign, which toLowerCase turns into "k"
  const I = '\u0130' // a dotted capital I, which toLowerCase turns into "i" and a combining dot
  const cases = [
    ['Elk Creek FSR', 'FSR', true],
    ['Forest-Service  Road 12', 'Forest Service Road', true],
    ['forest SERVICE road', 'Forest Service Road', true],
    ['FS 400', 'FS', true],
    ['NF-123', 'NF', true],
    ['FS400', 'FS', false],
    ['Forestview Service Road', 'Forest Service Road', false],
    ['Road of the Forest Service', 'Forest Service Road', false],
    ['Forest Service Access Road', 'Forest Service Road', false],
    [`${K}FS 9`, 'FS', true],
    ['FS\u2013400', 'FS', true],
    ['FS\u2013400', 'FS400', false],
    [`${K}FS 9`, 'KFS', false],
    [`${I}FS`, 'FS', true],
    [`${I}FS`, 'IFS', false],
    ['anything', '', false],
    ['anything', '--', false],
    ['', 'FS', false],
  ]
  for (const [value, phrase, want] of cases) {
    assert.equal(hasWords(value, phrase), want, `${JSON.stringify(value)} has ${JSON.stringify(phrase)}`)
  }
})

test('forest roads', () => {
  const marks = [{ name: 'Example Creek FSR' }, { ref: 'FS 400' }, { operator: 'US Forest Service' }]
  for (const highway of ['service', 'unclassified', 'track']) {
    for (const mark of marks) {
      const want = highway === 'track' ? ['forest_roads', 'trails'] : ['forest_roads']
      assert.deepEqual(categoriesFor('way', { highway, ...mark }), want, `${highway} ${JSON.stringify(mark)}`)
    }
  }
  const cases = [
    ['way', { highway: 'unclassified', name: 'Example Creek FSR' }, ['forest_roads']],
    ['way', { highway: 'service', ref: 'FS 400' }, ['forest_roads']],
    ['way', { highway: 'service', operator: 'US Forest Service' }, ['forest_roads']],
    ['way', { highway: 'track', ref: 'FS 123' }, ['forest_roads', 'trails']],
    ['way', { highway: 'track' }, ['trails']],
    ['way', { highway: 'service', service: 'driveway', surface: 'gravel', name: 'Example Ranch Road' }, []],
    ['way', { highway: 'unclassified', name: 'Forest Road' }, []],
    ['way', { highway: 'residential', name: 'Example FSR' }, []],
    ['way', { highway: 'residential', ref: 'FS 400' }, []],
    ['way', { highway: 'residential', operator: 'US Forest Service' }, []],
    ['way', { ref: 'FS 400' }, []],
    ['way', { highway: 'service', ref: 'FS\u2013400' }, ['forest_roads']],
    ['way', { highway: 'path', name: 'Example FSR' }, ['trails']],
    ['way', { highway: 'service', name: 'example FOREST-service  road 12' }, ['forest_roads']],
    ['way', { highway: 'service', name: 'Example Forest Service Access Road' }, []],
    ['way', { highway: 'service', ref: 'NF-123' }, ['forest_roads']],
    ['way', { highway: 'service', ref: 'FS400' }, []],
    ['way', { highway: 'service', name: 'Forestview Service Road' }, []],
    ['way', { highway: 'service', name: 'Road of the Forest Service' }, []],
    ['way', { highway: 'service', ref: '\u212AFS 9' }, ['forest_roads']],
    // Each mark list belongs to its own key.
    ['way', { highway: 'service', name: 'FS 400' }, []],
    ['way', { highway: 'service', ref: 'Example Creek Resource Road' }, []],
    ['way', { highway: 'service', operator: 'BC Timber Sales' }, ['forest_roads']],
    ['way', { highway: 'service', name: 'Example Resource Rd' }, ['forest_roads']],
    ['way', { highway: 'service', ref: 'USFS 12' }, ['forest_roads']],
    ['node', { highway: 'service', name: 'Example Creek FSR' }, []],
    ['node', { natural: 'volcano' }, ['peaks']],
    ['way', { natural: 'volcano' }, []],
  ]
  for (const [element, tags, want] of cases) {
    assert.deepEqual(categoriesFor(element, tags), want, `${element} ${JSON.stringify(tags)}`)
  }
})

test('the forest-road marks are garmin-map\'s', () => {
  const fr = CATEGORIES.find((c) => c.id === 'forest_roads')
  const highway = { k: 'highway', anyOf: ['service', 'unclassified', 'track'] }
  assert.deepEqual(fr.selectors, [
    { element: 'way', conditions: [highway, { k: 'name', words: ['FSR', 'NFSR', 'Forest Service Road', 'Forest Service Rd', 'National Forest Development Road', 'Resource Road', 'Resource Rd'] }] },
    { element: 'way', conditions: [highway, { k: 'ref', words: ['FS', 'FR', 'NF', 'NFSR', 'FSR', 'USFS'] }] },
    { element: 'way', conditions: [highway, { k: 'operator', words: ['Forest Service', 'USFS', 'Ministry of Forests', 'BC Timber Sales'] }] },
  ])
})

test('tag rules', () => {
  const cases = [
    ['node', { natural: 'peak' }, ['peaks']],
    ['node', { natural: 'volcano' }, ['peaks']],
    ['node', { mountain_pass: 'yes' }, ['passes']],
    ['node', { natural: 'saddle' }, ['passes']],
    ['node', { tourism: 'alpine_hut' }, ['huts']],
    ['node', { tourism: 'wilderness_hut' }, ['huts']],
    ['node', { amenity: 'shelter' }, ['huts']],
    ['node', { natural: 'hot_spring' }, ['hot_springs']],
    ['node', { highway: 'trailhead' }, ['trailheads']],
    ['node', { amenity: 'parking' }, ['parking']],
    ['way', { highway: 'path' }, ['trails']],
    ['way', { highway: 'footway' }, ['trails']],
    ['way', { highway: 'track' }, ['trails']],
    ['way', { highway: 'bridleway' }, ['trails']],
    ['way', { natural: 'ridge' }, ['ridges']],
    // A node in two categories; a ridge that is also a track.
    ['node', { natural: 'peak', mountain_pass: 'yes' }, ['peaks', 'passes']],
    ['way', { highway: 'track', natural: 'ridge' }, ['trails', 'ridges']],
    // Nothing else.
    ['way', { highway: 'residential' }, []],
    ['node', { highway: 'path' }, []],
    ['way', { natural: 'peak' }, []],
    ['node', { mountain_pass: 'no' }, []],
    ['node', { barrier: 'gate' }, []],
  ]
  for (const [element, tags, want] of cases) {
    assert.deepEqual(categoriesFor(element, tags), want, `${element} ${JSON.stringify(tags)}`)
  }
})

test('osmium pre-filter covers every rule', () => {
  assert.deepEqual(osmiumFilters(), [
    'n/natural=peak',
    'n/natural=volcano',
    'n/mountain_pass=yes',
    'n/natural=saddle',
    'n/tourism=alpine_hut,wilderness_hut',
    'n/amenity=shelter',
    'n/natural=hot_spring',
    'n/highway=trailhead',
    'n/amenity=parking',
    'w/highway=service,unclassified,track',
    'w/highway=path,footway,track,bridleway',
    'w/natural=ridge',
  ])
})

test('OPL lines are parsed, escapes decoded', () => {
  assert.deepEqual(parseOplLine('n101 Tnatural=peak,name=Example%20%Peak x-106.062 y39.6249996'), {
    type: 'node',
    id: 101,
    tags: { natural: 'peak', name: 'Example Peak' },
    lon: '-106.062',
    lat: '39.6249996',
  })
  assert.deepEqual(parseOplLine('n5 Tname=A%20%b%2c%c%3d%d%25%e%40%f%1f600%,natural=peak x2 y1').tags, {
    name: 'A b,c=d%e@f😀',
    natural: 'peak',
  })
  assert.deepEqual(parseOplLine('w201 Thighway=footway,area=yes Nn1x-106.1y39.6,n2xy,n3x-106.1y39.62'), {
    type: 'way',
    id: 201,
    tags: { highway: 'footway', area: 'yes' },
    nodes: [
      { lon: '-106.1', lat: '39.6' },
      null,
      { lon: '-106.1', lat: '39.62' },
    ],
  })
  assert.deepEqual(parseOplLine('w7 T Nn1x1y2,n2'), { type: 'way', id: 7, tags: {}, nodes: [{ lon: '1', lat: '2' }, null] })
  assert.equal(parseOplLine('r9 Ttype=route Mw1@'), null)
  assert.equal(parseOplLine(''), null)
})

test('coordinates are rounded to six decimals, halves away from zero', () => {
  assert.equal(roundCoord('39.6249996', 90), 39.625)
  assert.equal(roundCoord('-106.062', 180), -106.062)
  assert.equal(roundCoord('39.6249995', 90), 39.625)
  assert.equal(roundCoord('-106.0000005', 180), -106.000001)
  assert.equal(roundCoord('-106.0000004', 180), -106)
  assert.equal(roundCoord('-0.0000004', 180), 0)
  assert.ok(!Object.is(roundCoord('-0.0000004', 180), -0))
  assert.equal(roundCoord('2', 180), 2)
  assert.equal(roundCoord('0.1234565', 180), 0.123457)
  assert.equal(roundCoord('', 90), null)
  assert.equal(roundCoord('91', 90), null)
  assert.equal(roundCoord('1e5', 180), null)
  assert.equal(JSON.stringify([roundCoord('-106.0000005', 180), roundCoord('39.6249995', 90)]), '[-106.000001,39.625]')
})

test('a peak becomes a Point with exactly the three properties', () => {
  const f = featureFromOpl(parseOplLine('n101 Tnatural=peak,name=Example%20%Peak,ele=4000 x-106.062 y39.6249996'))
  assert.deepEqual(f, {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-106.062, 39.625] },
    properties: { title: 'Example Peak', _osmCategories: ['peaks'], _osmId: 'node/101' },
  })
})

test('a node in two categories', () => {
  const f = featureFromOpl(parseOplLine('n303 Tnatural=peak,mountain_pass=yes x1 y2'))
  assert.deepEqual(f.properties, { title: '', _osmCategories: ['peaks', 'passes'], _osmId: 'node/303' })
})

test('a closed footway marked as an area stays a LineString', () => {
  const f = featureFromOpl(
    parseOplLine('w201 Thighway=footway,area=yes Nn1x-106.1y39.6,n2x-106.09y39.61,n3x-106.1y39.62,n1x-106.1y39.6'),
  )
  assert.equal(f.geometry.type, 'LineString')
  assert.deepEqual(f.geometry.coordinates.at(0), f.geometry.coordinates.at(-1))
  assert.deepEqual(f.properties, { title: '', _osmCategories: ['trails'], _osmId: 'way/201' })
})

test('an unnamed track has title "" and no other tag', () => {
  const f = featureFromOpl(parseOplLine('w9 Thighway=track,surface=gravel Nn1x1y1,n2x1.5y1.5'))
  assert.deepEqual(Object.keys(f.properties), ['title', '_osmCategories', '_osmId'])
  assert.equal(f.properties.title, '')
})

test('unlocated vertices are dropped; a way needs two located vertices', () => {
  const f = featureFromOpl(parseOplLine('w10 Thighway=path Nn1x1y1,n2xy,n3x2y2'))
  assert.deepEqual(f.geometry.coordinates, [
    [1, 1],
    [2, 2],
  ])
  assert.equal(featureFromOpl(parseOplLine('w11 Thighway=path Nn1x1y1,n2xy')), null)
  assert.equal(featureFromOpl(parseOplLine('n12 Tnatural=peak x y')), null)
})

test('elements outside every category give no feature', () => {
  assert.equal(featureFromOpl(parseOplLine('w203 Thighway=residential Nn1x1y1,n2x2y2')), null)
  assert.equal(featureFromOpl(parseOplLine('n3 Tbarrier=gate x1 y1')), null)
  assert.equal(featureFromOpl(parseOplLine('n4 Thighway=path x1 y1')), null)
})

test('a clipped region keeps no point outside its bounds, but keeps whole ways', () => {
  const clip = { south: 39, west: -107, north: 40, east: -106 }
  assert.equal(featureFromOpl(parseOplLine('n1 Tnatural=peak x-106.5 y40.5'), { clip }), null)
  assert.ok(featureFromOpl(parseOplLine('n2 Tnatural=peak x-106.5 y40'), { clip }))
  const way = featureFromOpl(parseOplLine('w3 Thighway=path Nn1x-106.5y40.5,n2x-106.5y39.5'), { clip })
  assert.equal(way.geometry.coordinates.length, 2)
})

test('a selector whose first condition is words stops the pre-filter', () => {
  const odd = [{ id: 'odd', selectors: [{ element: 'way', conditions: [{ k: 'name', words: ['FSR'] }, { k: 'highway', equals: 'service' }] }] }]
  assert.throws(() => osmiumFilters(odd), /odd/)
})
