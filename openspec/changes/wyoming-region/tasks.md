# Tasks

## 1. Wyoming in the list

- [ ] 1.1 Tests first: the repository's list is `colorado` then `wyoming`, valid, with the plan output `regions=["colorado","wyoming"]`; Wyoming's entry and proposed bounds (design open question 1) are pinned. Seen to fail, then `regions.json`; verify `npm test`

## 2. Review

- [ ] 2.1 `/sdd:conformance-review wyoming-region`
- [ ] 2.2 Scan the diff for private material (this repository is public)

## 3. Decisions

- [ ] 3.1 The bounds ADR, once the owner answers open question 1

## Workflow follow-up

- After the owner merges: the owner starts a run; record Wyoming's measurements in `docs/measurements.md`.
- Archive this change in its own PR after it merges.
