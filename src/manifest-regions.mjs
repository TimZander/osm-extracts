// Prints how many regions a site's manifest.json lists, after checking it has the manifest's form;
// exits 1 (with the reason) when it is missing or malformed. Used by publish.sh (spec: "Publishing
// replaces the site with one orphan commit").
//
//   node src/manifest-regions.mjs <site-dir>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateManifest } from './assemble-site.mjs'

try {
  const m = validateManifest(JSON.parse(readFileSync(join(process.argv[2], 'manifest.json'), 'utf8')))
  console.log(m.regions.length)
} catch (e) {
  console.error(`::error::The site has no valid manifest.json: ${e.message}`)
  process.exit(1)
}
