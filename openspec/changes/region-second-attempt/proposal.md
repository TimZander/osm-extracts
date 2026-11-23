# Proposal

## Why

Geofabrik refused some region jobs' downloads two Mondays running (runs #11 and #12). A refused job
was refused on all three attempts (ADR 0037, about 2.5 minutes), while other region jobs in the same
run downloaded fine, and the same region built when it ran again on another runner (2026-11-13
British Columbia; 2026-11-23 Wyoming and Alberta). The refusal follows the runner, not the hour, so
moving the schedule (ADR 0039) is unlikely to be enough, and longer waits on the same runner would
only fail later.

## What Changes

- When any region's job fails, the workflow builds that region once more, in a second-attempt job on a
  fresh runner, with the same read-only permissions and the same build. The second attempt is skipped
  when every region succeeded.
- A region counts as failed only when both attempts fail; the deploy job waits for the second attempts
  and publishes every region that succeeded on either.
- The second-attempt job has the region job's 120-minute limit.
- A new ADR records that the refusals follow the runner, correcting the time-of-day reasoning of
  ADR 0039 (the 14:23 UTC schedule itself stays).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `osm-extract`: adds the second attempt; "A region job hands its tree to the deploy job and writes
  nothing", "A failed region keeps its previous files", "Every job has a time limit" and "Only the
  deploy job can write the repository" now cover the second-attempt job.

## Impact

- `.github/workflows/extract.yml`: a new job between `region` and `deploy`; `deploy` also needs it.
  High-risk file: `/security-review` and an attack test before merge.
- `test/workflow.test.mjs`: the job list, the new job's permissions, trigger, steps and limits.
- `docs/decisions/`: ADRs for the second attempt and for the corrected reasoning.
- Cost: nothing when every region passes; when one fails, a short job per region (it finds an
  artifact and stops) plus one rebuild per failed region. The repository is public, so minutes are free.
