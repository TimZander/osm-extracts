# Proposal: weekly-extract

## Why

garmin-map's OpenStreetMap import no longer asks public Overpass. It reads a static regional extract
from `https://osm.timzander.com` (garmin-map ADRs 0226, 0231). Nothing builds that extract yet: the
site serves only a placeholder page. This repository is where the pipeline lives (garmin-map ADRs 0228,
0229). Its requirements were drafted in garmin-map while this repository had no spec, and this change
moves them here as the first capability.

## What Changes

- A new capability, `osm-extract`: what the extract holds, how it is gridded and split, the manifest
  and file format it publishes (the format garmin-map's `osm-import` spec reads), the guards that stop
  a bad run, how a run replaces the site, and the licence notice.
- A GitHub Actions workflow that rebuilds the extract once a week and on demand, never from a pull
  request. One job per region builds that region's files with no write access. One final deploy job,
  the only job that can write, assembles the whole site and force-pushes it to the orphan `data`
  branch as one commit. Cloudflare Pages' Git integration serves that branch at `osm.timzander.com`.
  Neither GitHub nor the workflow holds a Cloudflare credential.
- Node scripts with tests: the category rules (copied from garmin-map at a pinned commit), the cell
  writer (grid, quarter splits, byte-stable output), the region guards, and the site assembler
  (manifest, `_headers`, `404.html`, `LICENSE.txt`, files carried over for one run, the file-count
  guard).
- A regions list holding only `colorado` for now.
- This repository's first ADRs, carrying over the garmin-map decisions the pipeline rests on.

## Capabilities

### New Capabilities

- `osm-extract`: builds the regional OpenStreetMap extract, keeps it fresh, and publishes it as a
  static site in the format garmin-map's import reads.

### Modified Capabilities

None. `openspec/specs/` is empty.

## Impact

- New: `.github/workflows/extract.yml`, `regions.json`, `src/*` (Node scripts and one shell script)
  and their tests, a fixture.
- New dev dependency: `yaml`, used only by the tests to read the workflow file.
- The `data` branch is overwritten by every run that changes something. Its placeholder is replaced
  by the first run.
- Runner tooling: `osmium-tool` from Ubuntu's archive, and Node 22.
- The first live run (`workflow_dispatch`) publishes to the live site. It waits for the owner's go.
