# Tasks

## 1. British Columbia in the list

- [x] 1.1 Tests first, citing "The regions list", scenario "Colorado, Wyoming, Utah, Idaho and British Columbia" (the four-region tests now use the list's first four entries): the repository's list is `colorado`, `wyoming`, `utah`, `idaho`, `british-columbia`, valid, with the plan output `regions=["colorado","wyoming","utah","idaho","british-columbia"]`; British Columbia's entry and bounds (design decision 2) are pinned. Seen to fail, then `regions.json`; verify `npm test`
- [x] 1.2 Test of the scenario's manifest half: the assembler, given the five regions' artifacts out of order and the repository's list, writes `regions` as `colorado`, `wyoming`, `utah`, `idaho`, `british-columbia`; the existing four-region assembler test takes the list's first four entries, so it still passes; verify `npm test`

## 2. Coverage past the US

- [x] 2.1 Test in `test/coverage.test.mjs`, citing "Each region lists the cells it covers": a fixture polygon from -141.8 to -139.0 lists cells in columns -568 to -557, written as `<row>_-568` and so on (design decision 5); verify `npm test` (expected to pass without code change; seen to fail by breaking the fixture first)
- [x] 2.2 Test, same requirement: a polygon dipping to 48.995, south of 49° N (a cell line), lists row 195 as well as 196, as does its neighbour reaching north past 49° N, so the border cells are in both; verify `npm test`

## 3. Review

- [ ] 3.1 `/sdd:conformance-review british-columbia-region`, findings routed with `/sdd:spec-fix`
- [ ] 3.2 Scan the diff for private material (this repository is public; only generic mentions of garmin-map)

## 4. Decisions

- [ ] 4.1 ADRs 0032 (bounds) and 0033 (order), with the index updated

## Workflow follow-up

- After the owner's "merge": archive this change in its own PR.
- Then one manual extract run on `main`, default inputs, once no other extract run is in progress (ADR 0027); record its measurements and British Columbia's coverage count in `docs/measurements.md`.
