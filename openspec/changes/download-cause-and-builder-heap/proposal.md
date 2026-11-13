# Proposal: download-cause-and-builder-heap

## Why

Two small fixes the owner asked for on 2026-11-13 ("do the small fix before BC"):

1. **A failed download says why.** In run 43362833261, Idaho's job failed with only
   `download of https://download.geofabrik.de/north-america/us/idaho-latest.osm.pbf failed: fetch failed`.
   Node's `fetch` puts the real error (a socket reset, a DNS failure, a TLS error) in `e.cause`, and
   `download()` dropped it, so the failure couldn't be diagnosed.
2. **The region builder gets a 12 GiB heap.** The British Columbia lane measured that a large region
   runs out of memory on Node's default heap at about 490 MB of output, and builds at
   `--max-old-space-size=12288` (6.7 GB RSS for 1.3 GB of output; the runner has 16 GB). The owner
   chose that option (ADR 0030).

## What Changes

- **`src/build-region.mjs`:** every failed download's error names its URL, a body cut off
  mid-stream included; when the request fails before any response, it also gives the underlying
  error's code and message (from `e.cause`, when it has one).
- **`.github/workflows/extract.yml`:** the region job's build step runs
  `node --max-old-space-size=12288 src/build-region.mjs …`. Nothing else in the workflow changes.
- **Spec (`osm-extract`):** "A failed or corrupt download publishes nothing new for the region" says
  what the error names and gets a scenario; a new requirement, "The region builder has a 12 GiB heap".
- **ADRs:** 0030 (the 12 GiB heap, the owner's answer) and 0031 (a failed download names its cause).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`: modified "A failed or corrupt download publishes nothing new for the region"; added
  "The region builder has a 12 GiB heap".

## Impact

- `src/build-region.mjs`, `.github/workflows/extract.yml`, `test/build-region.test.mjs`,
  `test/workflow.test.mjs`.
- The workflow is high-risk (CLAUDE.md): the change gets `/security-review` and an attack test. It adds
  one flag to a fixed command line; no new input, permission, secret or action.
- The live site doesn't change until the next run.
