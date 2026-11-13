# Decisions

Architecture and process decisions, one per file, as [MADR 4.0](https://adr.github.io/madr/)
records: `NNNN-short-title.md`, numbered in order. Copy [`template.md`](template.md) to start
one. A superseded record stays, with its status set to `superseded by NNNN`.

| No. | Decision | Status |
|---|---|---|
| [0001](0001-pipeline-and-its-spec-live-here.md) | The pipeline and its spec live here; the data contract stays with its consumer | accepted |
| [0002](0002-gridded-geojson-with-quarter-splits.md) | Plain GeoJSON in 0.25° cells, dense cells split into 0.125° quarters | accepted |
| [0003](0003-osmium-and-node-with-pinned-category-rules.md) | osmium narrows the data, Node builds the features; category rules pinned to a garmin-map commit | accepted |
| [0004](0004-static-pages-from-an-orphan-data-branch.md) | Static Cloudflare Pages from an orphan `data` branch, no Cloudflare credential | accepted |
| [0005](0005-pages-headers-and-404.md) | CORS and cache times in `_headers`, set per path; a `404.html` | accepted |
| [0006](0006-regions-colorado-first-one-at-a-time.md) | Regions: Colorado first, then one at a time | accepted |
| [0007](0007-workflow-security-model.md) | The workflow runs only on a schedule or by hand; only its deploy job writes | accepted |
| [0008](0008-split-threshold-4-mib-until-measured.md) | The split threshold is 4 MiB until the first run measures the cells | superseded by 0017 |
| [0009](0009-colorado-bounds-unclipped.md) | Colorado's bounds are the state's bounding box; not clipped | superseded by 0016 |
| [0010](0010-weekly-schedule-monday-0523-utc.md) | Rebuilt every Monday at 05:23 UTC | accepted |
| [0011](0011-guards-20-mib-19000-files-one-day-artifacts.md) | Guards at 20 MiB per file and 19,000 files; artifacts kept one day | accepted |
| [0012](0012-region-order-after-colorado-is-the-owners-call.md) | The region order after Colorado stays the owner's call | accepted |
| [0013](0013-irregular-state-coverage-waits.md) | Coverage of non-rectangular states waits for garmin-map | superseded by 0020 |
| [0014](0014-schedule-inactivity-risk-deferred.md) | The schedule-inactivity risk is deferred | deferred |
| [0015](0015-no-empty-push.md) | A run whose manifest lists no region pushes nothing | accepted |
| [0016](0016-colorado-bounds-inside-the-state-lines.md) | Colorado's bounds lie just inside the state lines | accepted |
| [0017](0017-split-threshold-stays-4-mib.md) | The split threshold stays 4 MiB, with no second split level | accepted |
| [0018](0018-wyoming-bounds-inside-the-state-lines.md) | Wyoming's bounds lie just inside the state lines | accepted |
| [0019](0019-wyoming-publishes-after-multi-region-search.md) | Wyoming merges only after garmin-map searches every region a view overlaps | accepted |
| [0020](0020-coverage-by-cells.md) | A region's coverage is the 0.25° cells its state polygon touches, listed in the manifest | accepted |
| [0021](0021-coverage-key-polygon-and-area-rule.md) | Coverage is a `coverage` list of cell ids, from Geofabrik's polygon, by shared area | proposed |
