---
status: accepted
date: 2026-11-07
decision-makers: the owner (answer to the split question in docs/measurements.md, run 2)
---
# The split threshold stays 4 MiB, with no second split level

## Context and Problem Statement

ADR 0008 set the split threshold at 4 MiB until a real run measured the cells. The first Colorado
build (run 42332492559) split 11 of 518 cells. Its largest file is still the Denver quarter
`colorado/158_-420/316_-839.json`, at 14.2 MiB raw, because a quarter is the smallest unit the format
has.

## Considered Options

- Keep 4 MiB, with no second split level
- Add a second split level (0.0625° cells), so that no file is over about 5 MiB
- Tighter categories, such as dropping unnamed `highway=footway` sidewalks

## Decision Outcome

Chosen option: "keep 4 MiB, with no second split level", the owner's answer ("keep it is fine").

The evidence came from the owner's browser on 2026-11-07:

- the 14.2 MiB quarter transfers as **2.41 MB with Brotli**, so the bytes on the wire are about a
  sixth of the file;
- every file is under the 20 MiB guard and garmin-map's 25 MiB body limit;
- a second split level would mean a change to garmin-map's contract, for about 28 more files.

### Consequences

- Good, because nothing changes in either repository.
- Neutral, because a denser region added later could produce a larger quarter. The 20 MiB guard then
  stops the run, naming the file, and the question comes back.
- This supersedes ADR 0008.
