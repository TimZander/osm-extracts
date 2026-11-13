# Proposal: download-retries

## Why

British Columbia's job in run 43456313065 failed on a single `ECONNREFUSED`, one second into its PBF
download. The same download had worked an hour earlier. Today one network failure fails a region's
job outright, and the region waits for the next run. The owner decided on 2026-11-13 that a download
is retried on a network failure. Alberta's first run waits for this change.

## What Changes

- **A download that fails at the network level is tried again,** up to 2 more times, after about
  30 s and then about 2 min (3 attempts in all). Each of the PBF, `.md5` and polygon gets its own
  attempts.
  - Retried: a refused or reset connection, a timeout, and an HTTP 5xx or 429 answer, with the error
    codes listed in a new requirement. A connection reset or timeout while the body streams is
    retried too, from the start of the file.
  - Not retried: a 404 or any other 4xx, any other error before a response (a TLS error, an unknown
    host), and a corrupt download (an MD5 mismatch). These fail at once, as today.
- **Each failed attempt is logged** on one line, with its URL, its attempt number out of 3, its cause
  (ADR 0031's wording), and the wait before the next attempt or "giving up".
- **When every attempt fails,** the region's job fails as today, and the manifest keeps the region's
  previous entry.
- **ADRs:**
  - 0037, the retry policy;
  - 0038, that Alberta's first run waits for this change (an exception to ADR 0027).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`:
  - "A failed or corrupt download publishes nothing new for the region": a download fails only
    after its last attempt, and the two network scenarios fail on every attempt.
  - New requirements: "A download is retried after a network failure", "Network-level download
    failures" and "Each failed download attempt is logged on one line".

## Impact

- **Files changed:**
  - `src/build-region.mjs`: `download` tries again, and the wait is injectable so tests use a fake;
  - `test/build-region.test.mjs`;
  - ADRs 0037 and 0038, and the index `docs/decisions/README.md`.
- **Not touched:** the workflow file and its job timeout of 120 minutes.
  - A file that keeps failing at once takes about 2.5 minutes longer to fail.
  - One whose every attempt hangs until Node's 300 s timeout takes up to about 15 minutes.
  - A download cut off near its end is downloaded again from the start.
  - All of this is inside the region job's limit.
- **Run time:** the live site and a run that downloads cleanly do not change.
