// The import's categories, copied from garmin-map's `OSM_CATEGORIES` (web/src/lib/osm.ts) at the
// commit below. Changing these rules is a change in both repositories (spec: "The category rules
// name the garmin-map commit they were copied from").

export const CATEGORIES_FROM = '1a498d2fe984186328b2a9e6fc7e1ad232329952'

// Each category: the OSM element it applies to, and rules (any one matching is enough), each a key
// and the values it may take.
export const CATEGORIES = [
  { id: 'peaks', element: 'node', rules: [{ k: 'natural', values: ['peak'] }] },
  {
    id: 'passes',
    element: 'node',
    rules: [
      { k: 'mountain_pass', values: ['yes'] },
      { k: 'natural', values: ['saddle'] },
    ],
  },
  {
    id: 'huts',
    element: 'node',
    rules: [
      { k: 'tourism', values: ['alpine_hut', 'wilderness_hut'] },
      { k: 'amenity', values: ['shelter'] },
    ],
  },
  { id: 'hot_springs', element: 'node', rules: [{ k: 'natural', values: ['hot_spring'] }] },
  { id: 'trailheads', element: 'node', rules: [{ k: 'highway', values: ['trailhead'] }] },
  { id: 'parking', element: 'node', rules: [{ k: 'amenity', values: ['parking'] }] },
  {
    id: 'trails',
    element: 'way',
    rules: [{ k: 'highway', values: ['path', 'footway', 'track', 'bridleway'] }],
  },
  { id: 'ridges', element: 'way', rules: [{ k: 'natural', values: ['ridge'] }] },
]

// Every category id the element matches, in catalog order.
export function categoriesFor(element, tags) {
  const ids = []
  for (const c of CATEGORIES) {
    if (c.element !== element) continue
    if (c.rules.some((r) => Object.hasOwn(tags, r.k) && r.values.includes(tags[r.k]))) {
      ids.push(c.id)
    }
  }
  return ids
}

// `osmium tags-filter` expressions that keep every candidate. osmium only narrows the input;
// categoriesFor decides.
export function osmiumFilters() {
  return CATEGORIES.flatMap((c) =>
    c.rules.map((r) => `${c.element === 'node' ? 'n' : 'w'}/${r.k}=${r.values.join(',')}`),
  )
}
