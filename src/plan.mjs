// The plan job: checks regions.json and prints the region jobs' matrix for $GITHUB_OUTPUT.
// Spec: "The regions list".
import { loadRegions, planOutput } from './regions.mjs'

try {
  console.log(planOutput(loadRegions()))
} catch (e) {
  console.error(`::error::${e.message}`)
  process.exit(1)
}
