---
status: accepted
date: 2026-11-23
decision-makers: the owner (2026-11-23, chose "Mon 14:23 UTC" after the two scheduled-run failures)
---
# The extract is rebuilt every Monday at 14:23 UTC, superseding ADR 0010

## Context and Problem Statement

The scheduled runs at 05:23 UTC failed two Mondays running (runs #11 on 2026-11-16 and #12 on
2026-11-23): every failing region job stopped at its Geofabrik download, with `ECONNREFUSED` from AWS
runners (still refused after ADR 0037's retries at 30 s and 2 min) and `HTTP 404` for existing
`*-latest.osm.pbf` files from Azure runners. The runs started by hand on 2026-11-13 between 14:00
and 16:30 UTC, run #10 on the same commit as #12, all succeeded. The cause on Geofabrik's side isn't
known (agent containers can't reach it); the failures follow the time of day, not the code.

## Considered Options

- Mondays at 14:23 UTC
- Mondays at 11:23 UTC
- Sundays at 14:23 UTC
- Keep 05:23 UTC and lengthen the retries, also retrying a 404

## Decision Outcome

Chosen option: "Mondays at 14:23 UTC", the owner's choice: the window where every hand-started run
has succeeded, on the same weekday, still a minute off the hour (ADR 0010's reason). Longer retries
were not chosen: they change ADR 0037, retrying a 404 hides a genuinely missing file, and they may
only fail later.

### Consequences

- Good, because the run moves away from the hour at which Geofabrik refused it twice.
- Neutral, because the data is published about nine hours later on Mondays than ADR 0010 planned.
- Bad, because the cause is inferred from two failures and three successes; if 14:23 also fails,
  the schedule or the retry policy needs another look.
