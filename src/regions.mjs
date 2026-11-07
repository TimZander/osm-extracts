// The regions list (regions.json). Spec: "The regions list".
import { readFileSync } from 'node:fs'

export const REGION_ID = /^[a-z0-9-]+$/
const GEOFABRIK_PATH = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/
const KEYS = ['id', 'name', 'geofabrik', 'bounds', 'clip']
const BOUND_KEYS = ['south', 'west', 'north', 'east']

export const REGIONS_FILE = new URL('../regions.json', import.meta.url)

function checkEntry(r, i) {
  const label = `regions.json entry ${i} (${typeof r?.id === 'string' ? r.id : 'no id'})`
  const fail = (why) => {
    throw new Error(`${label}: ${why}`)
  }
  if (typeof r !== 'object' || r === null || Array.isArray(r)) fail('not an object')
  for (const k of Object.keys(r)) if (!KEYS.includes(k)) fail(`unknown key "${k}"`)
  if (typeof r.id !== 'string' || !REGION_ID.test(r.id)) fail('id must be one or more of a-z, 0-9 and -')
  if (typeof r.name !== 'string' || r.name.trim() === '') fail('name must be a non-empty string')
  if (typeof r.geofabrik !== 'string' || !GEOFABRIK_PATH.test(r.geofabrik)) fail('geofabrik must be a path such as north-america/us/colorado')
  if (typeof r.clip !== 'boolean') fail('clip must be true or false')
  const b = r.bounds
  if (typeof b !== 'object' || b === null) fail('bounds must be an object')
  for (const k of Object.keys(b)) if (!BOUND_KEYS.includes(k)) fail(`unknown bounds key "${k}"`)
  for (const k of BOUND_KEYS) if (typeof b[k] !== 'number' || !Number.isFinite(b[k])) fail(`bounds.${k} must be a number`)
  if (!(b.south >= -90 && b.north <= 90 && b.west >= -180 && b.east <= 180)) fail('bounds out of range')
  if (!(b.south < b.north)) fail('bounds.south must be below bounds.north')
  if (!(b.west < b.east)) fail('bounds.west must be below bounds.east')
}

// Throws, naming the entry, when the list breaks a rule.
export function validateRegions(list) {
  if (!Array.isArray(list)) throw new Error('regions.json must be an array')
  if (list.length === 0) throw new Error('regions.json has no region')
  const seen = new Set()
  list.forEach((r, i) => {
    checkEntry(r, i)
    if (seen.has(r.id)) throw new Error(`regions.json: region ${r.id} is listed twice`)
    seen.add(r.id)
  })
  return list
}

export function loadRegions(file = REGIONS_FILE) {
  return validateRegions(JSON.parse(readFileSync(file, 'utf8')))
}

// The plan job's output line: the matrix of region ids.
export function planOutput(list) {
  return `regions=${JSON.stringify(list.map((r) => r.id))}`
}
