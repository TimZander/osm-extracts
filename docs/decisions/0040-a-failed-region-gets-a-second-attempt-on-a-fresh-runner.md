---
status: accepted
date: 2026-11-23
decision-makers: the owner (2026-11-23, "Yes" to Claude's recommendation of a second attempt on a fresh runner; change region-second-attempt). Decisions 4 and 5 below are assumptions under that answer, which the owner can overturn.
---
# A failed region gets one second attempt on a fresh runner

## Context and Problem Statement

In runs #11 and #12, Geofabrik refused some region jobs on every one of ADR 0037's three attempts
(about 2.5 minutes), while other region jobs in the same run downloaded fine. The same regions built
when they ran again on another runner: British Columbia on 2026-11-13, Wyoming and Alberta on
2026-11-23 (run #12, attempt 2). A refusal seems to follow the runner's address. Retrying from the
same runner doesn't get a new address.

## Considered Options

- A second-attempt job, `region-again`, on a fresh runner, for regions with no artifact
- Longer waits between download retries (changing ADR 0037)
- Re-running the failed jobs through the Actions API from inside the run
- Downloading from a mirror when Geofabrik refuses

## Decision Outcome

Chosen option: "a second-attempt job on a fresh runner". It is the only option that gets a new
address without a new permission.
- **Longer waits** keep the refused address.
- **Re-running through the API** needs a token with `actions: write`, against ADR 0007.
- **A mirror** is a second outside source to trust, and none is known to serve the same per-state
  files.

How the job works:
1. It runs after the region jobs only when `needs.region.result != 'success'`, so a run where every
   region passes doesn't start it. A timed-out leg may count as `cancelled`, so the check isn't
   `== 'failure'`.
2. It finds the regions to rebuild by trying to download each region's artifact, with the runner's own
   artifact token. The pinned `download-artifact` fails when the artifact doesn't exist.
3. It builds with the region job's steps, copied, and a test keeps the two equal.
4. Every failure gets a second attempt, not only refused downloads (assumption). The job can't tell
   the cause, and a real build error just fails twice.
5. No wait before the second attempt (assumption). The point is a new runner, not more time.

### Consequences

- Good, because a region refused on one runner is published the same week, with no new permission
  and no cost when nothing failed.
- Bad, because a run that the second attempt rescued still ends red: the region job's failure stands.
  Look at `region-again`. If it built and uploaded the region, the run published everything.
- Neutral, because a leg for a region that already succeeded starts a runner only to find its
  artifact. That's about a minute each, only in a run where something failed, and Actions minutes are
  free on this public repository.
