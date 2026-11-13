---
status: accepted
date: 2026-11-13
decision-makers: the owner ("do the small fix", 2026-11-13, relayed by the orchestrator; change download-cause-and-builder-heap)
---
# A failed download names its URL and its underlying cause

## Context and Problem Statement

Idaho's first run (43362833261) failed with `download of …/idaho-latest.osm.pbf failed: fetch failed`.
Node's `fetch` keeps the real error (a reset socket, a DNS or TLS failure) in `cause`, and the job
dropped it, so the failure couldn't be told from any other. The retry (43364250202) built Idaho.

## Considered Options

- (a) Name the URL and, for a failure before any response, `cause`'s code and message; name the URL
  for a body cut off mid-stream too
- (b) (a) plus a retry of each download
- (c) Leave the error as it is

## Decision Outcome

Chosen option: "(a)", what the owner asked for. (b) would change what a run does during a Geofabrik
outage, and a retry policy is better chosen once real causes have been seen; (c) leaves the next
failure as opaque as the first.

### Consequences

- Good, because a failed download's log line says what failed and why, e.g.
  `… failed: fetch failed (cause: ECONNRESET: read ECONNRESET)`.
- Neutral, because a failed download still fails the region's job alone, as before.
