# Tasks

## 1. Check the assumption

- [ ] 1.1 Read the pinned `actions/download-artifact` source and confirm a missing `name` fails the step; if it doesn't, check the downloaded path instead and update design decision 2.

## 2. Tests first (seen to fail)

- [ ] 2.1 `test/workflow.test.mjs`: jobs are `plan`, `region`, `region-again`, `deploy`; `region-again` needs `plan` and `region`, has the `if` of design decision 1, the region matrix with `fail-fast: false`, `timeout-minutes: 120` and `contents: read`; `deploy` needs all three.
- [ ] 2.2 Its first step downloads `region-${{ matrix.region }}` with no token and `continue-on-error: true`; every later step runs only when that step failed, and those steps equal the region job's steps.
- [ ] 2.3 The existing permission, checkout, pinned-action and no-expression-in-`run` tests cover the new job (extend where they list jobs).

## 3. Workflow

- [ ] 3.1 Add `region-again` to `.github/workflows/extract.yml` and add it to `deploy`'s `needs`; update the header comment's security model.

## 4. Review and records

- [ ] 4.1 `npm test`, `bash scripts/sdd/check-specs.sh`.
- [ ] 4.2 `/sdd:conformance-review region-second-attempt`.
- [ ] 4.3 `/security-review` on the diff, and an attack test: the new job holds no write permission and no token, and runs on nothing but the extract's own triggers.
- [ ] 4.4 ADRs: the second attempt; the refusals follow the runner, not the hour (ADR 0039's reasoning). Index both.
- [ ] 4.5 After merge, the next run that has a refused region shows it rebuilt by `region-again`; record it in `docs/measurements.md`.
