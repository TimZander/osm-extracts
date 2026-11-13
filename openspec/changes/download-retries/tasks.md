# Tasks

## 1. Retries

- [x] 1.1 Tests first, in `test/download-retries.test.mjs`, one per scenario, each with a fake fetch and a fake `sleep` that records waits:
  - "A download is retried after a network failure" (7 scenarios);
  - "Network-level download failures" (5 scenarios);
  - a 5xx, then a 429, then success.

  Seen to fail; verify `npm test`.
- [x] 1.2 Tests, citing "A failed or corrupt download publishes nothing new for the region": its two network scenarios fail on every attempt, with 3 requests each, and nothing of the region changes. The existing 404 and MD5 tests still pass. Verify `npm test`.
- [x] 1.3 Test that the default `sleep` waits: with `node:test` mock timers, a download that fails once doesn't make its second request until 30 s have been ticked. Verify `npm test`.
- [x] 1.4 Tests for "Each failed download attempt is logged on one line" (4 scenarios). Its "A hostile cause" scenario is the attack test: CR, LF and `::warning::` in the cause keep every log line single, with none starting with `::`. Verify `npm test`.
- [x] 1.5 The code in `src/build-region.mjs`: `download` retries per design decisions 2–8, and `buildRegion` passes `sleep` and `log` through. Verify `npm test`.

## 2. Review

- [x] 2.1 `/sdd:conformance-review download-retries`, findings routed with `/sdd:spec-fix` (conforms with gaps; C1, M1 and S1 fixed in code and tests, no spec change)
- [x] 2.2 Scan the diff for private material (the repository is public): nothing private

## 3. Decisions

- [x] 3.1 ADR 0037 (the retry policy, the owner's decision) and ADR 0038 (Alberta's first run waits for this change, an exception to ADR 0027), with the index updated

## Workflow follow-up

- After the owner's "merge": archive this change in its own PR.
- The owner's answers to the open questions, if they differ from the assumptions, are a follow-up change and ADRs.
- Then Alberta's first run (ADR 0038), once no other extract run is in progress.
