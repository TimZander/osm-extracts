---
status: accepted
date: 2026-11-13
decision-makers: the owner (2026-11-13, relayed by the orchestrator; change download-retries), including the answers to that change's five open questions ("The owner accepts all five of your recommendations")
---
# A download that fails at the network level is retried twice, after 30 s and 2 min

## Context and Problem Statement

British Columbia's job in run 43456313065 failed with `ECONNREFUSED` one second into its PBF
download. The same download had worked an hour earlier. One transient network failure failed the
region, which then waited for the next run. ADR 0031 made a failure name its cause, and set a retry
policy aside until real causes had been seen. This is one.

## Considered Options

- (a) Retry network-level failures up to 2 times, after about 30 s and then about 2 min, logging
  each failed attempt with its cause and number
- (b) Retry every failure the same way
- (c) No retry; a failed region waits for the next run, or a hand re-run of the job

## Decision Outcome

Chosen option: "(a)", decided by the owner on 2026-11-13.
- **Retried:** a refused or reset connection, a timeout, or an HTTP 5xx or 429. These are
  network-level failures.
- **Not retried:** a 404 or any other 4xx, and a corrupt or short file, which fail at once.
- **When every attempt fails,** the region fails as today and keeps its previous entry.

(b) would wait minutes on failures a retry can't fix, such as a 404 or a bad checksum. (c) is what
failed in run 43456313065.

The owner also answered the change's five open questions on 2026-11-13, accepting the change
author's recommendation for each:
1. **Timeout:** no timeout of our own. Node's 300 s headers and body timeouts count as the timeout
   that is retried.
2. **Retry-After:** ignored; the waits are always 30 s, then 2 min.
3. **A reset or timeout while the body streams:** retried from the start of the file. An MD5
   mismatch on a complete file is not retried.
4. **Network-level error codes:** `ECONNREFUSED`, `ECONNRESET`, `EPIPE`, `UND_ERR_SOCKET`,
   `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT`,
   `ENETUNREACH`, `EHOSTUNREACH` and `EAI_AGAIN`. Everything else, `ENOTFOUND` and TLS errors among
   it, fails at once.
5. **Attempts:** 3 per file, the PBF, `.md5` and polygon each.

Alternatives the answers set aside:
- a shorter timeout of our own;
- honouring Retry-After, which would let the server set the job's wait;
- resuming a cut-off file with a range request;
- one budget of retries shared by the three files.

The change author chose the exact waits (30 000 and 120 000 ms) and the log line's wording
(download-retries design decisions 2 and 6).

### Consequences

- Good, because a single refused or reset connection no longer costs a region its weekly refresh.
- Good, because each failed attempt is logged on one line with its cause, so the next pattern of
  failures can be read from the log.
- Bad, because a real outage takes up to 2.5 minutes longer to fail per file, and more if attempts
  hang until Node's 300 s timeouts (about 52 minutes for a region at worst). That is still inside
  the job's 120-minute limit.
