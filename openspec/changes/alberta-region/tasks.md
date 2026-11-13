# Tasks

## 1. Alberta in the list

- [x] 1.1 Tests first, citing "The regions list", scenario "Colorado, Wyoming, Utah, Idaho, British Columbia and Alberta": the repository's list is `colorado`, `wyoming`, `utah`, `idaho`, `british-columbia`, `alberta`, valid, with the plan output `regions=["colorado","wyoming","utah","idaho","british-columbia","alberta"]`; the five-region tests take the list's first five entries; Alberta's entry and bounds (design decision 2) are pinned. Seen to fail, then `regions.json`; verify `npm test`
- [x] 1.2 Test of the scenario's manifest half: the assembler, given the six regions' artifacts out of order and the repository's list, writes `regions` as `colorado`, `wyoming`, `utah`, `idaho`, `british-columbia`, `alberta`; the existing five-region assembler test takes the list's first five entries, so it still passes; verify `npm test`

## 2. Review

- [ ] 2.1 `/sdd:conformance-review alberta-region`, findings routed with `/sdd:spec-fix`
- [ ] 2.2 Scan the diff for private material (this repository is public; only generic mentions of garmin-map)

## 3. Decisions

- [x] 3.1 ADRs 0035 (bounds) and 0036 (order), with the index updated

## Workflow follow-up

- After the owner's "merge": archive this change in its own PR.
- Then one manual extract run on `main`, default inputs, once no other extract run is in progress (ADR 0027); record its measurements, Alberta's coverage count and its cells shared with British Columbia in `docs/measurements.md`.
