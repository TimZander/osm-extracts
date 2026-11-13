# Tasks

## 1. Utah in the list

- [x] 1.1 Tests first, citing "The regions list", scenario "Colorado, Wyoming and Utah" (the "Colorado and Wyoming" tests now use the list's first two entries; a build test's unlisted-region example moved from `utah` to `idaho`): the repository's list is `colorado`, `wyoming`, `utah`, valid, with the plan output `regions=["colorado","wyoming","utah"]`; Utah's entry and proposed bounds (design open question 1) are pinned. Seen to fail, then `regions.json`; verify `npm test`
- [x] 1.2 Test of the scenario's manifest half: the assembler, given the three regions' artifacts out of order and the repository's list, writes `regions` as `colorado`, `wyoming`, `utah`; verify `npm test`

## 2. Borders

- [x] 2.1 Test citing "The manifest describes every region", scenario "A border cell in two regions": `colorado` and `utah` artifacts both holding cell `152_-437` with the same trail publish it in both entries' `cells` and `coverage` and both files; verify `npm test` (expected to pass without code change, design decision 4; seen to fail by breaking the fixture first)
- [x] 2.2 Test in `test/coverage.test.mjs`, citing "Each region lists the cells it covers" (coverage from each region's own polygon alone): two fixture polygons on either side of -109.05 each cover the column -437 cells along that line, so both lists hold them; verify `npm test`

## 3. Review

- [x] 3.1 `/sdd:conformance-review utah-region`, findings routed with `/sdd:spec-fix` (conforms with gaps: S1 added to design open question 3, S2 the border test compares bytes)
- [x] 3.2 Scan the diff for private material (this repository is public; only generic mentions of garmin-map): only generic mentions of garmin-map

## 4. Decisions

- [ ] 4.1 ADRs for the owner's answers to design open questions 1–3 (bounds, order, merge timing), with the index updated

## Workflow follow-up

- After the owner merges: the next run (the owner's or Monday's) publishes Utah; record its measurements and coverage count in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
