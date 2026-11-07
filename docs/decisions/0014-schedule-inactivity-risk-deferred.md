---
status: deferred
date: 2026-11-07
decision-makers: the owner (answer to weekly-extract design open question 8)
---
# The risk that GitHub disables the schedule after 60 days without activity is deferred

## Context and Problem Statement

GitHub disables a public repository's scheduled workflows after 60 days without repository activity.
It is unconfirmed whether the deploy job's own pushes to `data` count as activity. If they don't, the
weekly rebuild could stop without any run failing.

## Considered Options

- Accept the risk: GitHub emails the owner before it disables a schedule, and re-enabling it is one click
- A keep-alive (a periodic commit, or an alert)
- Defer the decision

## Decision Outcome

Chosen option: "defer", the owner's answer. Neither acceptance nor a keep-alive is decided. This
stays a known, open risk, to be decided later or once it is seen whether the `data` pushes keep the
schedule alive.

### Consequences

- Bad, because the schedule may stop after 60 quiet days, and until then the risk is only watched.
