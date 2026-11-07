# Tasks

## 1. Bounds guard

- [x] 1.1 Tests first: `rectInsidePoly` reports the first failing point in the spec's order (corners SW, SE, NE, NW; then a vertex; then an edge), as `(lat, lon)`; `buildRegion`'s error names the region and that point. Seen to fail, then the code; verify `npm test`

## 2. No empty push

- [x] 2.1 Tests first: `publish.sh prepare` writes `changed=false` and logs the no-region reason when the manifest lists no region, before the unchanged check; fails on a missing or invalid manifest. Update the existing publish tests to use manifests that list a region. Seen to fail, then the script; verify `npm test`

## 3. Colorado bounds and decisions

- [x] 3.1 `regions.json` gets Colorado's proposed bounds (design open question 1), and the regions test pins them; verify `npm test`
- [x] 3.2 ADR 0015 (no empty push, owner-decided), in the index. The bounds ADR waits for the owner's answer

## 4. Review

- [x] 4.1 `/security-review` of the workflow-run code touched (`publish.sh`, `poly.mjs`) (no finding; `docs/security-review.md`)
- [x] 4.2 Attack test of the publish decision: an empty-region manifest, a missing manifest and an invalid one, each refused unpushed; recorded in `docs/attack-test.md`
- [ ] 4.3 `/sdd:conformance-review colorado-bounds-and-empty-push`

## Workflow follow-up

- After the owner merges: one `workflow_dispatch` run, with the owner's go; record the measurements in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
