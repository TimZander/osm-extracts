# Decisions

Architecture and process decisions, one per file, as [MADR 4.0](https://adr.github.io/madr/)
records: `NNNN-short-title.md`, numbered in order. Copy [`template.md`](template.md) to start
one. A superseded record stays, with its status set to `superseded by NNNN`.

| No. | Decision | Status |
|---|---|---|
| [0001](0001-pipeline-and-its-spec-live-here.md) | The pipeline and its spec live here; the data contract stays with its consumer | accepted |
| [0002](0002-gridded-geojson-with-quarter-splits.md) | Plain GeoJSON in 0.25° cells, dense cells split into 0.125° quarters | proposed |
| [0003](0003-osmium-and-node-with-pinned-category-rules.md) | osmium narrows the data, Node builds the features; category rules pinned to a garmin-map commit | proposed |
| [0004](0004-static-pages-from-an-orphan-data-branch.md) | Static Cloudflare Pages from an orphan `data` branch, no Cloudflare credential | accepted |
| [0005](0005-pages-headers-and-404.md) | CORS and cache times in `_headers`, set per path; a `404.html` | proposed |
| [0006](0006-regions-colorado-first-one-at-a-time.md) | Regions: Colorado first, then one at a time | proposed |
| [0007](0007-workflow-security-model.md) | The workflow runs only on a schedule or by hand; only its deploy job writes | proposed |
