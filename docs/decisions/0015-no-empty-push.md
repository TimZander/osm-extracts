---
status: accepted
date: 2026-11-07
decision-makers: the owner (rule); Claude (where it is checked, and the job's status, change colorado-bounds-and-empty-push open questions 2 and 3)
---
# A run whose manifest lists no region pushes nothing

## Context and Problem Statement

The first live run (2026-11-07) built no region: Colorado failed its bounds check. With no previous
regions either, the deploy job published a site whose manifest lists no region, over the placeholder.
The spec allowed it, but an empty site replacing what is there is never what anyone wants.

## Considered Options

- Push nothing when the new manifest lists no region
- Keep publishing whatever the run assembles (the first spec's behaviour)
- Fail the whole run when no region builds

## Decision Outcome

Chosen option: "push nothing when the manifest lists no region", the owner's decision ("add the
no-empty-push rule"). `publish.sh prepare` checks it before comparing trees, so the log names this
reason even when the tree is also unchanged. The deploy job then ends green: the failed region jobs
already turn the run red (Claude's choice, open question 2). A site with no manifest of the
manifest's form fails the job (Claude's choice, open question 3).

### Consequences

- Good, because the live site can only move from one extract with regions to another.
- Neutral, because the empty site already published (`fb60804`) stays until a run builds a region.
