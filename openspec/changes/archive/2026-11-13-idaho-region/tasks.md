# Tasks

## 1. Idaho in the list

- [x] 1.1 Tests first, citing "The regions list", scenario "Colorado, Wyoming, Utah and Idaho" (the three-region tests now use the list's first three entries; a build test's unlisted-region example moves from `idaho` to `montana`): the repository's list is `colorado`, `wyoming`, `utah`, `idaho`, valid, with the plan output `regions=["colorado","wyoming","utah","idaho"]`; Idaho's entry and bounds (design decision 2) are pinned. Seen to fail, then `regions.json`; verify `npm test`
- [x] 1.2 Test of the scenario's manifest half: the assembler, given the four regions' artifacts out of order and the repository's list, writes `regions` as `colorado`, `wyoming`, `utah`, `idaho`; verify `npm test`

## 2. Coverage at Idaho's borders

- [x] 2.1 Test in `test/coverage.test.mjs`, citing "Each region lists the cells it covers": two fixture polygons on either side of -111.05 (the Idaho–Wyoming line, column -445) both list the column -445 cells along it; verify `npm test` (expected to pass without code change; seen to fail by breaking the fixture first)
- [x] 2.2 Test, same requirement: two fixture polygons each reaching 0.01° past 42° N (a cell line, Geofabrik's margin) both list rows 167 and 168 along it, and polygons ending exactly on 42° N list only their own row; verify `npm test`
- [x] 2.3 Test, same requirement: a panhandle-shaped fixture polygon (a wide south and a strip about 1° wide to 49° N) lists the strip's cells and none of the cells east of the strip; verify `npm test`

## 3. Review

- [x] 3.1 `/sdd:conformance-review idaho-region`, findings routed with `/sdd:spec-fix` (conforms, no findings)
- [x] 3.2 Scan the diff for private material (this repository is public; only generic mentions of garmin-map): only generic mentions

## 4. Decisions

- [x] 4.1 ADRs 0028 (bounds) and 0029 (order), with the index updated; the publishing decision is ADR 0027 (PR #14), which already marks ADR 0026 superseded, so it isn't recorded twice

## Workflow follow-up

- After the owner's "merge": one manual extract run on `main`, default inputs, once no other extract run is in progress and Utah's run has published Utah (ADR 0027); record its measurements and Idaho's coverage count in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
