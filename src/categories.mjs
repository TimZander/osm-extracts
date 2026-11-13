// The import's categories, copied from garmin-map's `OSM_CATEGORIES` (web/src/lib/osm.ts) at the
// commit below. Changing these rules is a change in both repositories (spec: "The category rules
// name the garmin-map commit they were copied from").

export const CATEGORIES_FROM = '755fe009346756284afcb7c187e9465236c7de0d'

// Each category: selectors, any one matching is enough. A selector: the OSM element it applies to
// and conditions, all of which must hold. A condition: a key and one of `equals` (one value),
// `anyOf` (a list of values) or `words` (phrases, any one of which the value has as words). The
// same shape garmin-map keeps them in, so the copy is a transcription (ADR 0034).

// What marks a way as a forest road ("Which ways are forest roads").
const FOREST_ROAD_MARKS = [
  {
    k: 'name',
    words: [
      'FSR',
      'NFSR',
      'Forest Service Road',
      'Forest Service Rd',
      'National Forest Development Road',
      'Resource Road',
      'Resource Rd',
    ],
  },
  { k: 'ref', words: ['FS', 'FR', 'NF', 'NFSR', 'FSR', 'USFS'] },
  { k: 'operator', words: ['Forest Service', 'USFS', 'Ministry of Forests', 'BC Timber Sales'] },
]

export const CATEGORIES = [
  {
    id: 'peaks',
    selectors: [
      { element: 'node', conditions: [{ k: 'natural', equals: 'peak' }] },
      { element: 'node', conditions: [{ k: 'natural', equals: 'volcano' }] },
    ],
  },
  {
    id: 'passes',
    selectors: [
      { element: 'node', conditions: [{ k: 'mountain_pass', equals: 'yes' }] },
      { element: 'node', conditions: [{ k: 'natural', equals: 'saddle' }] },
    ],
  },
  {
    id: 'huts',
    selectors: [
      { element: 'node', conditions: [{ k: 'tourism', anyOf: ['alpine_hut', 'wilderness_hut'] }] },
      { element: 'node', conditions: [{ k: 'amenity', equals: 'shelter' }] },
    ],
  },
  { id: 'hot_springs', selectors: [{ element: 'node', conditions: [{ k: 'natural', equals: 'hot_spring' }] }] },
  { id: 'trailheads', selectors: [{ element: 'node', conditions: [{ k: 'highway', equals: 'trailhead' }] }] },
  { id: 'parking', selectors: [{ element: 'node', conditions: [{ k: 'amenity', equals: 'parking' }] }] },
  {
    id: 'forest_roads',
    selectors: FOREST_ROAD_MARKS.map((mark) => ({
      element: 'way',
      conditions: [{ k: 'highway', anyOf: ['service', 'unclassified', 'track'] }, mark],
    })),
  },
  {
    id: 'trails',
    selectors: [{ element: 'way', conditions: [{ k: 'highway', anyOf: ['path', 'footway', 'track', 'bridleway'] }] }],
  },
  { id: 'ridges', selectors: [{ element: 'way', conditions: [{ k: 'natural', equals: 'ridge' }] }] },
]

// Every category's element type (a category's selectors all name the same one).
for (const c of CATEGORIES) c.element = c.selectors[0].element

// ASCII letters lowercased, nothing else (design decision 2), then split at every character that
// isn't a-z or 0-9 ("How a tag value has a phrase as words").
function wordsOf(text) {
  return text
    .replace(/[A-Z]/g, (ch) => ch.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0)
}

// Whether `value` has `phrase` as words: the phrase's words next to each other, in order.
export function hasWords(value, phrase) {
  const v = wordsOf(value)
  const p = wordsOf(phrase)
  if (p.length === 0) return false
  for (let i = 0; i + p.length <= v.length; i++) {
    if (p.every((w, j) => v[i + j] === w)) return true
  }
  return false
}

function conditionMet(cond, tags) {
  if (!Object.hasOwn(tags, cond.k)) return false
  const value = tags[cond.k]
  if (cond.equals !== undefined) return value === cond.equals
  if (cond.anyOf !== undefined) return cond.anyOf.includes(value)
  if (cond.words !== undefined) return cond.words.some((phrase) => hasWords(value, phrase))
  throw new Error(`a condition on ${cond.k} has no equals, anyOf or words`)
}

// Every category id the element matches, in catalog order.
export function categoriesFor(element, tags) {
  return CATEGORIES.filter((c) =>
    c.selectors.some((s) => s.element === element && s.conditions.every((cond) => conditionMet(cond, tags))),
  ).map((c) => c.id)
}

// `osmium tags-filter` expressions that keep every candidate: one per selector, from its first
// condition, each written once (design decision 3). osmium only narrows the input; categoriesFor
// decides.
export function osmiumFilters(categories = CATEGORIES) {
  const out = []
  for (const c of categories) {
    for (const s of c.selectors) {
      const first = s.conditions[0]
      const values = first.equals !== undefined ? [first.equals] : first.anyOf
      if (!values) throw new Error(`category ${c.id}: a selector's first condition must be equals or anyOf`)
      const expr = `${s.element === 'node' ? 'n' : 'w'}/${first.k}=${values.join(',')}`
      if (!out.includes(expr)) out.push(expr)
    }
  }
  return out
}
