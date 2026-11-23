# Design: region-second-attempt

## Context

See proposal.md. `extract.yml` runs `plan`, then one `region` job per listed region (matrix,
`fail-fast: false`, `contents: read`, 120 min), then `deploy`, which runs unless the run was cancelled
or `plan` failed, downloads every `region-*` artifact and keeps a missing region's previous files.
GitHub-hosted runners are fresh VMs, each with an address from GitHub's pool. A refused runner stayed
refused through ADR 0037's three attempts; another runner was let through minutes later.

The owner chose this approach on 2026-11-23 ("Yes" to: a second attempt on a fresh runner; keep
14:23 UTC; record that the time-of-day reasoning wasn't confirmed).

## Goals / Non-Goals

**Goals:** a region refused on one runner gets one more try on another, in the same run, with no new
permission and no cost when nothing failed.

**Non-Goals:** changing the download retries (ADR 0037), the schedule (ADR 0039), or what the deploy
job accepts; a third attempt; a download mirror.

## Decisions

1. **A separate job, `region-again`, after `region`.** It needs `plan` and `region`, and runs only
   when `!cancelled() && needs.plan.result == 'success' && needs.region.result == 'failure'`, so it is
   skipped when every region succeeded. `deploy` also needs it; its `if` already uses `!cancelled()`,
   so a skipped `region-again` doesn't stop it.
   Rejected:
   - *Retrying inside the region job* (longer waits, a loop): same runner, same refused address.
   - *Re-running failed jobs through the API*: needs a token with `actions: write`, against ADR 0007.
   - *A mirror*: a second outside source to trust, and none known to serve the same per-state files.
2. **Which regions to rebuild: the ones with no artifact.** A job can't read which matrix legs failed
   (`needs.region.result` is one value for the whole matrix, and matrix legs' outputs overwrite each
   other). So `region-again` has the same matrix, and its first step tries
   `actions/download-artifact` for `region-<id>` with `continue-on-error: true`; every later step runs
   only when that step failed. The download uses the runner's own artifact token, so the job keeps
   `contents: read` alone.
   Rejected: listing the run's artifacts through the REST API, which needs `actions: read` and a
   token passed to a step.
3. **The build steps are the region job's, copied.** Checkout without credentials, install osmium,
   build with the 12 GiB heap, upload `region-<id>` as the last step. A test asserts they equal the
   region job's steps, so the two can't drift. (YAML anchors would also work, but the tests and
   reviewers read plain steps more easily.)
4. **Every failure gets a second attempt, not only refused downloads.** The job can't tell why a leg
   failed without new outputs. A real build error (a bounds failure, a too-large file) just fails
   twice; the cost is bounded by the 120-minute limit.
5. **No wait before the second attempt.** The first attempt has already spent about 2.5 minutes in
   retries, and a new runner is the point; a wait adds time without adding a new address.
6. **ADRs**: one for the second attempt (decisions 1–5), and one recording that the refusals follow
   the runner, not the hour. ADR 0039's schedule stays; its status stays `accepted`, and the index
   row points at the new record for the corrected reasoning.

## Risks / Trade-offs

- [The second runner is refused too] → the region keeps last week's files, as today; the job log
  shows both attempts.
- [The artifact check fails for a reason other than "not found"] → the job rebuilds, and its upload
  fails on the name that already exists; the deploy job still has the first artifact. Harmless, and
  logged.
- [A region job's matrix leg for a succeeded region still starts a runner] → about a minute each, and
  only in a run where something failed; the repository is public, so minutes are free.
- [A run takes longer when a region fails] → up to one more region build; well inside the deploy's
  reach, which has no deadline of its own until it starts.

## Migration Plan

Merge; the next scheduled or hand-started run uses it. Rollback is reverting the workflow commit.

## Open Questions

- Does `actions/download-artifact` at the pinned SHA fail (not succeed with nothing) when the named
  artifact doesn't exist? Assumed yes; task 1.1 checks its source before the job relies on it.
