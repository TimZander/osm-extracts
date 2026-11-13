# Design: download-retries

## Context

See proposal.md. `download(url, dest, fetchImpl)` in `src/build-region.mjs` makes one request.
- **Failure before any response:** it throws, naming the URL and `cause` (ADR 0031).
- **Not-OK status:** it throws, naming the status.
- **Body fails mid-stream:** it throws, naming the URL and `cause`.

`buildRegion` downloads the PBF, `.md5` and polygon in turn, and the first throw fails the job. The
job then publishes nothing new for the region, and the deploy job keeps the region's previous entry.
Node's `fetch` (undici) has no overall timeout by default. It does give up after 300 s with no
response headers (`UND_ERR_HEADERS_TIMEOUT`), or 300 s with no body data (`UND_ERR_BODY_TIMEOUT`).

The evidence for the change: British Columbia's job in run 43456313065 failed with `ECONNREFUSED` one
second into its PBF download, an hour after the same download had worked.

## Decisions

1. **The owner's policy** (2026-11-13, relayed by the orchestrator; ADR 0037):
   - up to 2 retries, after about 30 s and then about 2 min, so 3 attempts;
   - only network-level failures are retried: a refused or reset connection, a timeout, an HTTP
     5xx or 429;
   - anything else fails at once: a 404 or other 4xx, a corrupt or short file;
   - each failed attempt is logged with its cause and attempt number;
   - when every attempt fails, the region fails as today;
   - Alberta's first run waits for this change (ADR 0038). In the owner's words, as relayed: "Record
     the owner's decisions in ADRs: the retry policy, and that Alberta's first run waits for it (an
     exception to ADR 0027's 'run right after merge')".
2. **The waits are exactly 30 000 ms and 120 000 ms.** The owner said "about", and fixed values keep
   the tests exact. No jitter: one job downloads one file at a time, so there is no herd to spread.
3. **A failure is network-level when** (the owner's answer to open question 4, 2026-11-13):
   - it answered HTTP 5xx or 429;
   - or it failed, before a response or while the body streamed, with one of these `cause` codes:
     - refused or reset: `ECONNREFUSED`, `ECONNRESET`, `EPIPE`, `UND_ERR_SOCKET`;
     - timeouts: `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`,
       `UND_ERR_BODY_TIMEOUT`;
     - unreachable network: `ENETUNREACH`, `EHOSTUNREACH`;
     - a DNS lookup that failed for now: `EAI_AGAIN`.

   Every other failure ends the download:
   - a cause with no code, or another code, such as `ENOTFOUND` (a name that doesn't exist) or a
     TLS code like `CERT_HAS_EXPIRED`;
   - another HTTP status;
   - an error writing the file.

   The list is the requirement "Network-level download failures".
4. **A retry starts the file again.** The next attempt makes a fresh request, and its write stream
   truncates the partial file. There are no range requests: the `.md5` check would catch a bad
   splice, but the gain is small for files of minutes.
5. **Each file has its own 3 attempts.** The PBF, `.md5` and polygon are downloaded in turn, as
   today, so a failure on the polygon doesn't download the PBF again.
6. **The log line**, one per failed attempt, is
   `Download attempt <n> of 3 for <url> failed: <reason>; retrying in <30 s|2 min>`.
   - On the last attempt, whether the third or one that isn't retried (a 404), it ends with
     `; giving up` instead.
   - `<reason>` is the error text ADR 0031 already writes (a status, or the underlying error's code
     and message, or the error's own message when it has no cause), with U+0000–U+001F and U+007F
     replaced by a space, the same filter as ADR 0031's. So a hostile cause can't start a workflow command (an attack test pins it).
   - The thrown error is the last attempt's, worded as today: the URL and that attempt's status or
     cause. The earlier attempts' causes are in their log lines.
7. **The wait and the log are injectable.** `download(url, dest, fetchImpl, { sleep, log })` takes a
   `sleep(ms)` that defaults to a `setTimeout` promise, and the `log` that `buildRegion` already has
   (default `console.log`). `buildRegion` passes both through.
   - The tests pass a fake that records the waits and resolves at once, so no test waits.
   - One test drives the default with `node:test`'s mock timers, to show the default really waits.
8. **No new timeout.** Undici's 300 s headers and body timeouts are the "timeout" that is retried
   (open question 1).

## Risks / Trade-offs

- **[Trade-off] A longer failing job.**
  - A file that fails at once on every attempt takes 2.5 minutes longer to fail.
  - If every attempt hangs to undici's 300 s timeout, it takes about 17.5 minutes (3 × 300 s + 2.5
    min).
  - With each of the three files doing so, a region takes about 52 minutes.
  - All of these are inside the job's 120-minute limit; measured builds take a few minutes.
- **[Risk] Retrying a real outage** costs those minutes and then fails as today. No data is at risk:
  a failed region keeps its previous entry.
- **[Risk] A code list that misses a transient failure.** It fails at once, as today, and its log
  line names its code, so a missing code shows in the log and can be added by a later change.

## Open Questions

None open. The five sent to the owner on 2026-11-13 were answered the same day, relayed by the
orchestrator: "The owner accepts all five of your recommendations". They are decided requirements
now, recorded in ADR 0037.

1. **Timeout length:** no timeout of our own. Undici's 300 s with no headers, or 300 s of a silent
   body, is the timeout that is retried (decision 8).
2. **Retry-After:** not honoured; the waits are always 30 s and 2 min (decision 2).
3. **A reset or timeout mid-body:** retried from the start of the file. An MD5 mismatch on a
   complete download is not retried (decision 4).
4. **Which failures are network-level:** the code list as recommended, including the unreachable
   network and `EAI_AGAIN`. Everything else fails at once, including `ENOTFOUND` and TLS errors
   (decision 3).
5. **Attempts:** 3 per file, the PBF, `.md5` and polygon each (decision 5).

## Spec review

Round 1: one blocker, A1, and four should-fix findings, all fixed in the delta.
- **A1:** the design retried an unreachable network and `EAI_AGAIN`, which the requirement didn't
  allow. They were dropped, to keep to the owner's words, and moved into open question 4.
- **D1:** the code list is now the requirement "Network-level download failures".
- **G1, E1:** the log line is now a requirement, "Each failed download attempt is logged on one
  line": its fields, "giving up", and the one-line guard.
- **D2:** the job's error is the last attempt's.

Also fixed:
- **C1:** "before or during the body" no longer reads as if it applied to a status.
- **F1:** the proposal gives the worst-case time.

Round 2: no blocker; another round not needed. Fixed:
- **C1:** a scenario where each file has its own attempts;
- **D1:** an MD5 mismatch is not a logged download attempt;
- **D2:** the cause for an error with no code, or with no underlying error;
- **H1:** decision 1 quotes the owner's decision that Alberta's first run waits;
- **F1:** the worst case is about 17.5 minutes per file and about 52 per region;
- **D3:** the characters kept out of the log are named: U+0000–U+001F and U+007F;
- **G1:** decision 7 gives `download` its `log`.

## Conformance review

Verdict: conforms with gaps. There were 3 soft fails and no hard fail; all three are fixed.
- **C1:** the log line's cause is now the cause alone: the HTTP status, else the underlying error's
  code and message, else the error's own message. Before, it repeated the whole thrown message, so
  the URL appeared twice. The tests pin whole lines.
- **M1:** the attack test also puts CR, LF, `::warning::` and NUL in the error's own message, the
  path only the one-line filter guards. With the filter disabled, the test fails.
- **S1:** an e2e test in `test/build-region-e2e.test.mjs` builds the region with real osmium after
  each file fails once: the PBF's body times out, the `.md5` is refused, the polygon answers 429.
  It runs where osmium is installed: here, 178 pass, 0 fail, 0 skipped (177 after the owner's
  answers removed two "not retried" tests and added one).

## After the owner's answers

- **Where the PR stood:** it had been opened on the round-1 code list, which had dropped
  `ENETUNREACH`, `EHOSTUNREACH` and `EAI_AGAIN`, the codes not named in the owner's first words.
- **The answer:** the owner then accepted the list as recommended, those three codes included.
- **What changed:** the requirement "Network-level download failures" lists them, with a scenario
  for `EAI_AGAIN`, and the tests and code follow, through the spec first.

Round 2, after the owner's answers changed the code list: one hard fail, M1, now fixed.
- **M1:** "A body cut off, then whole" couldn't catch an append, because its fake body failed before
  any byte reached the file.
- **The fix:** the fake now sends `PARTIAL-` first. The test checks those bytes are on disk before
  the second response, then that the file holds only the second body.
- **Check:** with the write stream switched to append (`flags: 'a'`), this test and the
  `UND_ERR_BODY_TIMEOUT` test fail.
- **Suite:** 177 pass, 0 fail, 0 skipped.
