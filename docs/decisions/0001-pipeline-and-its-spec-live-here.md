---
status: accepted
date: 2026-11-07
decision-makers: the owner (repository and its spec), Claude (proposed the split)
---
# The pipeline and its spec live in this repository; the data contract stays with its consumer

## Context and Problem Statement

garmin-map's OpenStreetMap import reads a static extract. Someone has to build it, and both sides need
a spec: the builder for what it writes, the reader for what it accepts. garmin-map is private, and its
runner minutes cost money. A public repository gets standard runners free.

## Considered Options

- The pipeline here with its own spec; the contract specified by the consumer (garmin-map ADRs 0228, 0229)
- The pipeline inside garmin-map
- Both specs in one repository

## Decision Outcome

Chosen option: "the pipeline and its spec here, the contract in garmin-map", because each spec sits
beside the code that implements and tests it. This repository's `osm-extract` capability states the
format it writes. garmin-map's `osm-import` capability states what it accepts, and it is the side that
breaks if the format changes.

### Consequences

- Good, because the weekly build runs on free runners, and garmin-map's deploys never carry OSM data.
- Good, because each repository's CI governs only its own code.
- Bad, because a change to the format is a change in both repositories, consumer first.
