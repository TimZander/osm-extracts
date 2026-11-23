# Tasks

## 1. Check the assumption

- [x] 1.1 Read the pinned `actions/download-artifact` source and confirm a missing `name` fails the step; if it doesn't, check the downloaded path instead and update design decision 2.
- [x] 1.2 Check GitHub's documentation for how `needs.<job>.result` aggregates a matrix with failed and timed-out legs, and that `cancelled()` stays false after a leg times out in a run nobody cancelled; note both in design decision 1.

## 2. Tests first (seen to fail)

- [x] 2.1 `test/workflow.test.mjs`: jobs are `plan`, `region`, `region-again`, `deploy`; `region-again` needs `plan` and `region`, has `if: ${{ !cancelled() && needs.plan.result == 'success' && needs.region.result != 'success' }}`, the region matrix with `fail-fast: false`, `timeout-minutes: 120` and `contents: read`; `deploy` needs all three.
- [x] 2.2 Its first step downloads `region-${{ matrix.region }}` with no token, `id: found` and `continue-on-error: true`; every later step has `if: steps.found.outcome == 'failure'`, and those steps, `if:` set aside, equal the region job's steps.
- [x] 2.3 The existing permission, checkout, pinned-action and no-expression-in-`run` tests cover the new job (extend where they list jobs).

## 3. Workflow

- [x] 3.1 Add `region-again` to `.github/workflows/extract.yml` and add it to `deploy`'s `needs`; update the header comment's security model.

## 4. Review and records

- [x] 4.1 `npm test`, `bash scripts/sdd/check-specs.sh`.
- [x] 4.2 `/sdd:conformance-review region-second-attempt`.
- [ ] 4.3 `/security-review` on the diff, and an attack test: the new job holds no write permission and no token, and runs on nothing but the extract's own triggers.
- [x] 4.4 ADRs: the second attempt; the refusals follow the runner, not the hour (ADR 0039's reasoning). Index both, and point ADR 0039's index row at the second.
- [ ] 4.5 After merge, the next run that has a refused region shows it rebuilt by `region-again`; record it in `docs/measurements.md` — not done in the change's PR: it needs a run after merge.
