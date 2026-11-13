# Tasks

## 1. Wyoming in the list

- [x] 1.1 Tests first: the repository's list is `colorado` then `wyoming`, valid, with the plan output `regions=["colorado","wyoming"]`; Wyoming's entry and proposed bounds (design open question 1) are pinned. Seen to fail, then `regions.json`; verify `npm test`
- [x] 1.2 Test of the scenario's manifest half: the assembler, given `colorado` and `wyoming` artifacts and the list in that order, writes `regions` as `colorado` then `wyoming`, citing the scenario; verify `npm test`

## 2. Review

- [x] 2.1 `/sdd:conformance-review wyoming-region` (3 soft fails, all fixed: M1 a list-order test not in id order, M2 bad entries after the first, R1 the weekly run in the rollout wording, design open question 3)
- [x] 2.2 Scan the diff for private material (this repository is public; only generic mentions of garmin-map, as elsewhere here)

## 3. Decisions

- [ ] 3.1 The bounds ADR, once the owner answers open question 1 — not done: waits for the owner's answer

## Workflow follow-up

- Before the first run that publishes Wyoming: garmin-map's change to search every region a view overlaps lands first, or with it.
- After the owner merges: the owner starts a run; record Wyoming's measurements in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
