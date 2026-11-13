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
   - when every attempt fails, the region fails as today.
2. **The waits are exactly 30 000 ms and 120 000 ms.** The owner said "about", and fixed values keep
   the tests exact. No jitter: one job downloads one file at a time, so there is no herd to spread.
3. **A failure is network-level when:**
   - it answered HTTP 5xx or 429;
   - or it failed, before a response or while the body streamed, with one of these `cause` codes:
     - refused or reset: `ECONNREFUSED`, `ECONNRESET`, `EPIPE`, `UND_ERR_SOCKET`;
     - timeouts: `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`,
       `UND_ERR_BODY_TIMEOUT`.

   That is the owner's two classes and nothing more. An unreachable network (`ENETUNREACH`,
   `EHOSTUNREACH`) and a DNS lookup that failed for now (`EAI_AGAIN`) are neither, so they are not
   retried; open question 4 asks whether they should be. The list is the requirement "Network-level
   download failures".

   Every other failure ends the download:
   - a cause with no code, or another code, such as `ENOTFOUND`, `EAI_AGAIN`, `ENETUNREACH` or a TLS
     code like `CERT_HAS_EXPIRED`;
   - another HTTP status;
   - an error writing the file.

   This is open question 4's assumption.
4. **A retry starts the file again.** The next attempt makes a fresh request, and its write stream
   truncates the partial file. There are no range requests: the `.md5` check would catch a bad
   splice, but the gain is small for files of minutes.
5. **Each file has its own 3 attempts.** The PBF, `.md5` and polygon are downloaded in turn, as
   today, so a failure on the polygon doesn't download the PBF again.
6. **The log line**, one per failed attempt, is
   `Download attempt <n> of 3 for <url> failed: <reason>; retrying in <30 s|2 min>`.
   - On the last attempt, whether the third or one that isn't retried (a 404), it ends with
     `; giving up` instead.
   - `<reason>` is the error text ADR 0031 already writes, a status or a cause, kept on one line by
     the same filter. So a hostile cause can't start a workflow command (an attack test pins it).
   - The thrown error is the last attempt's, worded as today: the URL and that attempt's status or
     cause. The earlier attempts' causes are in their log lines.
7. **The wait is injectable.** `download` and `buildRegion` take a `sleep(ms)` that defaults to a
   `setTimeout` promise.
   - The tests pass a fake that records the waits and resolves at once, so no test waits.
   - One test drives the default with `node:test`'s mock timers, to show the default really waits.
8. **No new timeout.** Undici's 300 s headers and body timeouts are the "timeout" that is retried
   (open question 1).

## Risks / Trade-offs

- **[Trade-off] A longer failing job.** A file that fails on every attempt takes 2.5 minutes longer
  to fail, and up to about 15 minutes if every attempt hangs to undici's 300 s timeout. Both are far
  inside the job's 120-minute limit.
- **[Risk] Retrying a real outage** costs those minutes and then fails as today. No data is at risk:
  a failed region keeps its previous entry.
- **[Risk] A code list that misses a transient failure.** It fails at once, as today, and its log
  line names its code, so a missing code shows in the log and can be added by a later change.

## Open Questions

Each was sent to the orchestrator for the owner on 2026-11-13. The change proceeds on the stated
assumption.

1. **Timeout length.**
   - *Assumption:* no timeout of our own. Undici's 300 s with no headers, or 300 s of a silent
     body, is the timeout that is retried.
   - *Alternative:* a shorter timeout of our own, e.g. 60 s with no data.
2. **Retry-After.**
   - *Assumption:* not honoured; the waits are always 30 s and 2 min.
   - *Why:* honouring it would let the server set the job's wait, and Geofabrik isn't known to send
     it.
3. **A reset or timeout mid-body.**
   - *Assumption:* retried, from the start of the file, as a reset connection.
   - *Unaffected:* an MD5 mismatch on a complete download is the "corrupt or short file" the owner
     excluded, and is not retried.
4. **Which no-response failures count as network-level.**
   - *Assumption:* decision 3's code list, only refused, reset and timed-out connections, as the
     owner named them.
   - *Not on it, so failing at once:*
     - `ENOTFOUND` (a name that doesn't exist) and TLS errors;
     - an unreachable network (`ENETUNREACH`, `EHOSTUNREACH`) and a DNS lookup that failed for now
       (`EAI_AGAIN`). These are transient too; adding them would be a small follow-up change.
5. **What gets the 3 attempts.**
   - *Assumption:* each file separately (decision 5).

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
