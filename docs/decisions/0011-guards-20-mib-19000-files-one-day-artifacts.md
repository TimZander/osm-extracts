---
status: accepted
date: 2026-11-07
decision-makers: the owner (answer to weekly-extract design open question 7)
---
# The guards stop at 20 MiB per file and 19,000 files, and artifacts are kept one day

## Context and Problem Statement

Pages allows 25 MiB per file and 20,000 files per site. A run that crossed either limit would fail its
deploy. Region trees go to the deploy job as Actions artifacts, which cost storage while they are kept.

## Considered Options

- 20 MiB and 19,000 files, below the limits with room for one regenerated tree; artifacts kept one day
- The limits themselves (25 MiB, 20,000)
- No guards, relying on Pages to refuse

## Decision Outcome

Chosen option: "20 MiB, 19,000 files, one day", the owner's choice of the default. A bad run stops
in GitHub, naming the file or the counts, before anything is pushed. The deploy job reads the
artifacts minutes after they are made, so one day is enough.

### Consequences

- Good, because the live site never receives a tree that Pages would reject.
- Neutral, because there is no guard on total size.
