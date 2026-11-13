---
status: accepted
date: 2026-11-13
decision-makers: the owner (2026-11-13, relayed by the orchestrator; change download-retries); the error-code list, the exact waits and the open questions in that change's design are the change author's, pending the owner
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

The change's author worked these out from the owner's words (design decisions 2–8 of
download-retries):
- the error codes that make a failure network-level, listed in the requirement "Network-level
  download failures";
- waits of exactly 30 000 and 120 000 ms;
- each file gets its own 3 attempts, starting again from the beginning;
- the wording of the log line.

Five open questions in that design are with the owner:
- the timeout length;
- Retry-After;
- a reset mid-body;
- unreachable-network and temporary-DNS errors;
- per-file attempts.

An answer that differs from the assumption is a new change and a new ADR.

### Consequences

- Good, because a single refused or reset connection no longer costs a region its weekly refresh.
- Good, because each failed attempt is logged on one line with its cause, so the next pattern of
  failures can be read from the log.
- Bad, because a real outage takes up to 2.5 minutes longer to fail per file, and more if attempts
  hang until Node's 300 s timeouts (about 52 minutes for a region at worst). That is still inside
  the job's 120-minute limit.
