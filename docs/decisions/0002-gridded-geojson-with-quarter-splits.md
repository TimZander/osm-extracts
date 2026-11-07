---
status: proposed
date: 2026-11-07
decision-makers: Claude (carried over from garmin-map ADRs 0220 and 0233); the owner accepts it with the PR
---
# The extract is plain GeoJSON in 0.25° cells, with dense cells split once into 0.125° quarters

## Context and Problem Statement

Cloudflare Pages answers a Range request with the whole file, caps a file at 25 MiB, and a free site
at 20,000 files. The reader must fetch only what lies under the searched area, and must get each
trail whole.

## Considered Options

- GeoJSON FeatureCollections per 0.25° cell, a dense cell split into its four 0.125° quarters
- 0.125° cells everywhere
- 0.25° cells everywhere
- A single archive read by Range (PMTiles, FlatGeobuf)

## Decision Outcome

Chosen option: "0.25° cells with one level of quarter splits" (garmin-map ADRs 0220, 0233), because
it works with Pages' static server as it is, keeps every feature whole, and fits the planned western
regions in about 8,000–9,000 files. A split cell always has all four of its quarter files, so the
reader needs no list of quarters.

### Consequences

- Good, because a dense urban cell still comes as files of a few MiB.
- Bad, because a line crossing a cell edge is stored in every cell it touches, so the reader dedupes
  by `_osmId`.
- The split threshold (4 MiB) is an assumption until the first Colorado run measures it (design open
  question 1).
