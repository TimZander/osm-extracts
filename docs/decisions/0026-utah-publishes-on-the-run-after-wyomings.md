---
status: superseded by 0027
date: 2026-11-13
decision-makers: the owner (the go-ahead of 2026-11-13 for a manual run publishing Wyoming; change utah-region, design open question 3)
---
# Utah publishes on the weekly run after Wyoming's own deploy

## Context and Problem Statement

Wyoming and `coverage` hadn't been published yet; the first run to do so would have been the weekly
run of Monday 2026-11-16 05:23 UTC (ADR 0010). Merging Utah before it would make that run upload two
new regions at once, against ADR 0006's "each deploy's new upload stays at about one region".

## Considered Options

- (a) Merge Utah before Monday's run, so that run publishes Wyoming and Utah together
- (b) Publish Wyoming first, on its own, and Utah on the run after it

## Decision Outcome

Chosen option: "(b)". On 2026-11-13 the owner gave the go-ahead for a manual run on main, without
Utah (run 43359776477), so Wyoming and `coverage` deploy alone today. Utah then merges, on the
owner's "merge" after they have checked today's data, and publishes on Monday's run. That keeps ADR
0006's pace without costing a week.

### Consequences

- Good, because each deploy adds one region, and Wyoming's and Utah's first measurements are taken
  on runs of their own.
- Neutral, because the extract workflow isn't started by hand for Utah: Monday's run publishes it.
