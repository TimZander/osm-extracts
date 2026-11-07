# Tasks

## 1. Bounds guard

- [ ] 1.1 Tests first: `rectInsidePoly` reports the first failing point (corner, vertex, edge); `buildRegion`'s error names the region and that point. Seen to fail, then the code; verify `npm test`

## 2. No empty push

- [ ] 2.1 Tests first: `publish.sh prepare` writes `changed=false` and logs the reason when the site's manifest lists no region, even if the tree changed. Seen to fail, then the script; verify `npm test`

## 3. Colorado bounds and decisions

- [ ] 3.1 `regions.json` gets Colorado's new bounds, and the regions test pins them; verify `npm test`
- [ ] 3.2 ADR 0015 (Colorado bounds, superseding 0009) and ADR 0016 (no empty push), in the index

## 4. Review

- [ ] 4.1 `/security-review` of the workflow-run code touched (`publish.sh`), and `/sdd:conformance-review colorado-bounds-and-empty-push`

## Workflow follow-up

- After the owner merges: one `workflow_dispatch` run, with the owner's go; record the measurements in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
