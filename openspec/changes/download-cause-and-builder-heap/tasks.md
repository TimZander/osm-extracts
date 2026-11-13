# Tasks

## 1. A failed download names its cause

- [x] 1.1 Test first, citing "A failed or corrupt download publishes nothing new for the region", scenario "A request that fails before any response": a fake fetch rejecting with `TypeError('fetch failed', { cause })`, the cause having code `ECONNRESET` and message `read ECONNRESET`, makes `download()` reject naming the URL, `ECONNRESET` and `read ECONNRESET`; a cause with no code gives its message alone; a response whose body fails mid-stream makes `download()` reject naming the URL; and `buildRegion` fails with nothing written. Seen to fail, then `src/build-region.mjs`; verify `npm test`

## 2. The builder's heap

- [x] 2.1 Test first in `test/workflow.test.mjs`, citing "The region builder has a 12 GiB heap": the region job's build step runs `node --max-old-space-size=12288 src/build-region.mjs "$REGION" --out "$RUNNER_TEMP/out/region-$REGION"`. Seen to fail, then `.github/workflows/extract.yml`; verify `npm test`

## 3. Review

- [ ] 3.1 `/sdd:conformance-review download-cause-and-builder-heap`, findings routed with `/sdd:spec-fix`
- [ ] 3.2 `/security-review` on the diff (the workflow is high-risk)
- [ ] 3.3 Attack test: the inputs an attacker could use against the changed lines (a crafted cause in the error, the region id reaching the command line), each checked to be refused or harmless
- [ ] 3.4 Scan the diff for private material (public repository)

## 4. Decisions

- [ ] 4.1 ADRs 0030 (the 12 GiB heap, the owner's answer) and 0031 (a failed download names its cause), with the index updated

## Workflow follow-up

- Archive this change in its own PR after it merges.
