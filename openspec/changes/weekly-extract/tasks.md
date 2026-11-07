# Tasks

## 1. Setup

- [x] 1.1 Add `regions.json` (Colorado only), the `test` npm script (`node --test`) and the `yaml` dev dependency; verify `npm test` runs with no tests failing

## 2. Category rules and features

- [x] 2.1 Tests first for the category rules, feature form and coordinate rounding (OPL lines in, features out), seen to fail; then `src/categories.mjs` and `src/features.mjs`; verify `npm test`

## 3. Cell writer

- [x] 3.1 Tests first for the grid, quarter splits, empty quarters, byte-stable output, sort order, manifest entry and the 20 MiB guard, seen to fail; then `src/cells.mjs`; verify `npm test`

## 4. Region job

- [ ] 4.1 Tests first for the regions-list checks (and the plan job's matrix output), a failed PBF or `.poly` download, the MD5 check, the data date, the bounds-in-polygon check and the size report, seen to fail; then `src/regions.mjs`, `src/poly.mjs` and `src/build-region.mjs`; verify `npm test`
- [ ] 4.2 An end-to-end test that runs `build-region.mjs` with the real `osmium` on a small fixture PBF (made from `test/fixtures/sample.osm`, including a clipped run); verify it passes locally

## 5. Site assembly and publishing

- [ ] 5.1 Tests first for the assembler: reading the previous tree (none, placeholder, broken manifest), only the extract's files kept, artifact checks, a failed region keeping its files, carry-over for one run, `manifest.json`, `_headers`, `404.html`, `LICENSE.txt` and the 19,000-file guard, seen to fail; then `src/assemble-site.mjs`; verify `npm test`
- [ ] 5.2 Tests first for `src/publish.sh` against a local bare repository: an orphan commit, a skip when nothing changed, a rejected lease; then the script; verify `npm test`

## 6. Workflow

- [ ] 6.1 Tests first that read `.github/workflows/extract.yml`: its triggers, permissions, SHA pins, `persist-credentials: false`, where `github.token` appears, no secrets, no `ACTIONS_STEP_DEBUG`, no `${{ }}` in `run:`, the plan job feeding the matrix, `fail-fast: false`, one-day artifact retention, and one concurrency group without cancel-in-progress; then the workflow; verify `npm test`

## 7. Reviews and decisions

- [ ] 7.1 ADRs 0001–0007 in `docs/decisions/`, added to its index
- [ ] 7.2 `/security-review` of the workflow and scripts; findings fixed through the spec
- [ ] 7.3 Attack test: a fork pull request runs nothing; a pull request that edits the workflow can't push `data`; only the deploy job writes; no secrets referenced. Done with a throwaway pull request if feasible, otherwise reasoned and recorded in `docs/attack-test.md`
- [ ] 7.4 `/sdd:conformance-review weekly-extract`; findings routed through `/sdd:spec-fix`

## Workflow follow-up

- After the owner merges (their go), dispatch the first run, then record in `docs/measurements.md` the matching nodes and ways, total size, largest 0.25° cell, cell and file counts, and the Pages deploy time against the 20-minute limit; report them to the coordinator.
- Set the split threshold from that measurement in its own change, with its ADR (design open question 1).
- Archive the change in its own PR after this one merges.
- In garmin-map, replace `docs/osm-extract-pipeline.md` with a link to this repository's spec (garmin-map ADR 0229).
