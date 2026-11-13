---
status: accepted
date: 2026-11-13
decision-makers: the owner (2026-11-13, relayed by the orchestrator: "Record the owner's decisions in ADRs: the retry policy, and that Alberta's first run waits for it")
---
# Alberta's first run waits for download retries, an exception to ADR 0027

## Context and Problem Statement

ADR 0027 lets a region's first extract run start by hand as soon as its PR merges. Alberta merged
in #24 on 2026-11-13. An hour earlier, British Columbia's job in run 43456313065 had failed on a
single `ECONNREFUSED`, a failure that one retry would have survived (ADR 0037).

## Considered Options

- Run Alberta at once, as ADR 0027 allows
- Wait until the download-retries change (ADR 0037) has merged and been archived, then run

## Decision Outcome

Chosen option: "wait for download retries", decided by the owner on 2026-11-13. Alberta's first run
starts after the download-retries change merges and is archived, once no other extract run is in
progress. It is a one-time exception: ADR 0027 still holds for later regions.

### Consequences

- Good, because Alberta's first run, and every run after it, survives a single refused or reset
  connection.
- Bad, because Alberta goes live later than ADR 0027 would allow, by the time one more change takes.
