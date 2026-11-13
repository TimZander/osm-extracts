---
status: accepted
date: 2026-11-13
decision-makers: the owner (chose option (a) of the British Columbia lane's measurement, 2026-11-13, relayed by the orchestrator; change download-cause-and-builder-heap)
---
# The region builder runs with a 12 GiB heap

## Context and Problem Statement

`src/build-region.mjs` holds every feature and every file's text in memory while `buildCells` files
them into cells. British Columbia's Geofabrik PBF is 1.2 GB (Colorado's is 370 MB, for 254 MB of
output), and its output is estimated at 300–900 MB. The region jobs run on GitHub's standard
`ubuntu-24.04` runner, which has 16 GB of RAM.

The British Columbia lane measured it on 2026-11-13, in an agent container rather than on a runner,
with Node v22.23.4 (the runner's version), whose default heap limit there was 2,096 MB. It used
synthetic input: N trail ways of 20 vertices each over a 7° × 4° box, through the repository's real
`buildCells`.

| Output | Peak RSS | Default heap |
|---|---|---|
| 324 MB | 1.70 GB | fits |
| 486 MB | 2.52 GB at `--max-old-space-size=12000` | out of memory |
| 648 MB | 3.38 GB at 12000 | out of memory |
| 1.30 GB | 6.73 GB at 12000 | out of memory |

That is about 5.2 bytes of RSS per output byte. On the default heap, the build runs out of memory
somewhere between 324 and 486 MB of output. Reading the OPL and osmium weren't measured, so a real
peak is somewhat higher. osmium runs before the Node build, not alongside it.

## Considered Options

- (a) Run the builder with `--max-old-space-size=12288` (12 GiB)
- (b) Write each file as it is built, instead of holding every text
- (c) Both (a) and (b)
- (d) Clip British Columbia to a rectangle

## Decision Outcome

Chosen option: "(a)", the owner's choice. It is one flag on the build step's command line and needs
no code change. 12,288 MiB leaves about 3.6 GB of the 16 GB runner for the OS, and the measurements
put even a 900 MB output well inside it. The flag is on the command line, not in `NODE_OPTIONS`, so it
applies to the builder alone.

The other options lost for these reasons:

- (b) is a larger code change and removes only the text half: the features are still held, so a
  900 MB region might still not fit.
- (c) is more work than British Columbia needs if 12 GiB is enough. It stays the fallback.
- (d) would lose the coast, Vancouver Island south of 49° N and the Kootenays.

### Consequences

- Good, because regions several times Colorado's size can build without touching the builder.
- Neutral, because the small regions don't use the room: V8 grows the heap only as needed.
- Bad, because a region needing more than 12 GiB still fails out of memory, alone. (b) or (c) is the
  way past that, in a later change if one is needed.
