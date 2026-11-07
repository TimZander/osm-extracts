# osm-extracts

A weekly, regional extract of the OpenStreetMap features garmin-map's import offers (peaks, passes,
huts, hot springs, trailheads, parking, trails, ridges), published as a static site at
<https://osm.timzander.com>.

- **What it builds:** `openspec/specs/osm-extract` (the spec), `docs/decisions/` (why).
- **How:** `.github/workflows/extract.yml` runs on a weekly schedule and by hand. One job per region in
  `regions.json` downloads Geofabrik's extract, filters it with osmium-tool and writes 0.25° GeoJSON
  cells. A deploy job then force-pushes the whole site to the orphan `data` branch as one commit.
  Cloudflare Pages serves that branch.
- **Locally:** `npm ci && npm test`. The end-to-end test needs `osmium-tool`, and uses a small fixture
  instead of a download.

Data © OpenStreetMap contributors, under the ODbL 1.0. See `LICENSE.txt` on the published site.
