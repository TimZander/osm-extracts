---
status: accepted
date: 2026-11-13
decision-makers: the owner (chose option (a) of the British Columbia lane's measurement, 2026-11-13, relayed by the orchestrator; change download-cause-and-builder-heap)
---
# The region builder runs with a 12 GiB heap

## Context and Problem Statement

`src/build-region.mjs` holds a region's features in memory while it files them into cells. Run with
Node's default old-space limit, a large region (measured by the British Columbia lane) ran out of
memory at about 490 MB of output. The region jobs run on GitHub's standard `ubuntu-24.04` runner,
which has 16 GB of RAM.

## Considered Options

- (a) Run the builder with `--max-old-space-size=12288` (12 GiB). Measured: the large region built,
  1.3 GB of output at 6.7 GB peak RSS
- (b) Keep the default heap and change the builder to stream features to disk
- (c) Keep the default heap and split a large region into several list entries

## Decision Outcome

Chosen option: "(a)", the owner's choice. One flag on the build step's command line, no code change,
measured to work with about 9 GB of headroom on the 16 GB runner. The flag is on the command line,
not in `NODE_OPTIONS`, so it applies to the builder alone. (b) is the lasting fix but a larger change
to the builder; (c) changes what the manifest and the app see.

### Consequences

- Good, because regions several times Colorado's size can build without touching the builder.
- Neutral, because the small regions don't use the room: V8 grows the heap only as needed.
- Bad, because a region needing more than 12 GiB still fails out of memory, alone; (b) is the way
  past that, in a later change if one is needed.
