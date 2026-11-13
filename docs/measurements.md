# Measurements

## Run 1: 2026-11-07, `workflow_dispatch` on `main` at `69c7d18` (run 42329501017)

**Colorado did not build, so there is nothing to measure yet.**

| Job | Result | Notes |
|---|---|---|
| plan | success | matrix `["colorado"]` |
| region (colorado) | **failure** at "Build the region", 44 s | The downloads took 43 s for the PBF, then the `.md5` and `.poly`. The MD5 check passed. Then `region colorado: its bounds reach outside its Geofabrik polygon`. No artifact was uploaded. |
| deploy | success, pushed | No artifact, and the previous tree (the placeholder, `1f8ea64`) had no manifest. So it published a site of 4 files whose manifest has `"regions": []`: `data` = `fb60804` (one parentless commit). |

What the run confirms:

- **Token permissions**, from the jobs' "GITHUB_TOKEN Permissions" blocks: the deploy job had
  `Contents: write, Metadata: read`. The PR probe earlier had the read-only default.
- **The deploy chain works end to end:** download-artifact with 0 artifacts, fetch-previous, the
  assembler (placeholder counted as no previous regions, `index.html` dropped), an orphan commit, and
  a push leased on `1f8ea64`.
- **Runner:** Ubuntu 24.04.5, osmium 1.16.0, Node v22.23.4.

Not measured (no Colorado build): matching nodes and ways, total size, largest 0.25° cell, cell and
file counts, and the Pages deploy time.

Open from this run:

1. **Colorado's `bounds`** (37 / -109.06 / 41 / -102.04, ADR 0009) lie partly outside Geofabrik's
   polygon. The guard doesn't say where. `download.geofabrik.de` is blocked from the agent container,
   so the polygon couldn't be read here.
2. **A run with no region ever built still publishes**, an empty manifest. That is what the spec says
   ("left out of the manifest"), but it replaced the placeholder page. Whether such a run should push
   at all is a new question for the owner.

## Run 2: 2026-11-07, `workflow_dispatch` on `main` at `91c75e5` (run 42332492559)

**Colorado built and is live.** All three jobs succeeded. `data` = `9d56941`, one parentless commit,
which replaced the empty site `fb60804`. Bounds: 37.01 / -109.04 / 40.99 / -102.06 (ADR 0016).
Geofabrik data of **2026-11-05**.

| Measurement | Value |
|---|---|
| Matching nodes | **6,254** (peaks 3,753; parking 1,180; trailheads 561; huts 523; passes 222; hot springs 23) |
| Matching ways | **499,067** (trails 496,494; ridges 2,575) |
| Total size | **253,588,286 bytes** (≈ 242 MiB) in region files; 253,600,284 bytes for the whole site |
| Largest 0.25° cell, before splitting | **`158_-420`, 32,010,480 bytes** (≈ 30.5 MiB; the Denver area), split into quarters |
| Largest file after splitting | `colorado/158_-420/316_-839.json`, 14,874,428 bytes (≈ 14.2 MiB), under the 20 MiB guard |
| Cells | **518**, of which **11** are split |
| Files | **551** region files; **555** in the site (plus `manifest.json`, `_headers`, `404.html`, `LICENSE.txt`) |
| File sizes | median 162,098 bytes; 48 files over 1 MiB |
| Artifact | 553 files (the region files, `entry.json` and `stats.json`), 48,172,051 bytes zipped |
| Pages deploy | Cloudflare Pages check run "Deployed successfully" at 03:09:47Z, for a push that ended at 03:09:12Z, so **about 35 s from push to live**, far inside the 20-minute limit. The check run gives no separate build time. |

Job timings:

- plan: 5 s.
- region: 1 min 28 s in all. Of that, 40 s was the PBF download, about 22 s the osmium steps and the
  cell writer, and 8 s the artifact upload.
- deploy: 22 s, of which the push took 12 s.

Checked against the published tree:

- the manifest lists 1 region, with `dataDate` `2026-11-05`, 518 cells and 11 split;
- `categoriesFrom` is `1a498d2`;
- the distinct node and way counts in the files equal the job's report.

Notes for the follow-ups:

- **The split threshold (ADR 0008).** At 4 MiB, 11 of 518 cells split. The largest quarter, 14.2 MiB,
  is the closest any file comes to the 20 MiB guard, about 70 % of it. Decided: the threshold
  stays (ADR 0017).
- **Trails make up 99.5 % of the ways**, which is what drives the size (garmin-map ADR 0220's estimate
  was 120–250 MB).

Open questions from this run, now answered:

1. **The 14.2 MiB Denver quarter and the split threshold: decided, keep it** (ADR 0017, superseding
   0008). The threshold stays 4 MiB, with no second split level. Evidence from the owner's browser,
   2026-11-07:
   - `colorado/158_-420/316_-839.json` (14.2 MiB raw) transfers as **2.41 MB with Brotli**;
   - `/manifest.json` is served with `Access-Control-Allow-Origin: *` and `Cache-Control` `max-age=300`;
   - a path that doesn't exist answers `404` with `Access-Control-Allow-Origin: *`.
2. **The Pages deploy time: answered.** The site is live about **35 s** after the push ends. This is
   read from the Cloudflare Pages check run on `9d56941` ("Deployed successfully" at 03:09:47Z, for a
   push that ended at 03:09:12Z). Cloudflare posts a check run, not a commit status. The exact build
   time is in the dashboard's build log, and isn't needed while it stays this far under the
   20-minute limit.

## Run 4: 2026-11-13, `workflow_dispatch` on `main` at `5d4f05c` (run 43359776477)

**Wyoming and `coverage` are published.** This was the first run with a second region and with
coverage by cells (ADRs 0020–0021), started by hand on the owner's go-ahead (ADR 0026). All four
jobs succeeded. `data` = `97efe8f` (replacing `9f569fb`), with 1,076 files. Geofabrik data of
**2026-11-12**.

| Region | Cells | Split | Coverage | Coverage rows / columns | Cells outside coverage |
|---|---|---|---|---|---|
| colorado | 518 | 11 | 522 | 147–164 / -437 to -409 | 2 |
| wyoming | 521 | 0 | 519 | 163–180 / -445 to -416 | 5 |

- **The borders, from the real polygons:** Geofabrik's outlines run a little past the state lines and
  cross the cell lines. Colorado covers 29 cells of row 164 (north of 41° N), and Wyoming covers 30
  cells of row 163. In all, 44 cells are in both regions' coverage, and no cell along the line is in
  neither.
- **Cells outside coverage** are trails the PBF keeps whole past the polygon (ADR 0021): they have
  files but aren't covered.
- **Timings:** plan 4 s, colorado 3 min 43 s (of which "Build the region" took 3 min 21 s), wyoming 50 s,
  deploy 32 s (of which the push took 14 s).

## Run 5: 2026-11-13, `workflow_dispatch` on `main` at `634384b` (run 43361499180)

**Utah is published**, on the owner's "run anytime after a state is added" (ADR 0027). All five jobs
succeeded. `data` = `97da03f`, with 1,533 files. Geofabrik data of **2026-11-12** for all three
regions.

| Measurement | colorado | wyoming | utah |
|---|---|---|---|
| Matching nodes | 6,251 | 4,942 | 4,790 |
| Matching ways | 500,401 | 105,233 | 348,052 |
| Total bytes | 254,119,156 | 106,197,116 | 200,332,870 |
| Largest cell before splitting | `158_-420`, 32,065,034 | `164_-420`, 2,784,578 | `162_-448`, 22,292,327 |
| Cells / split | 518 / 11 | 521 / 0 | 433 / 8 |
| Files | 551 | 521 | 457 |
| Coverage cells | 522 | 519 | 419 |
| Artifact, zipped | 48,261,178 | 25,617,512 | 40,031,163 |
| Region job | 1 min 55 s | 38 s | 2 min 27 s |

What the run confirms for Utah (change utah-region):

- **The bounds guard passed** with 37.01 / -114.03 / 40.99 / -109.06 (ADR 0024), though the polygon
  was never read from the agent container.
- **Coverage, 419 cells,** in rows 147–168 and columns -457 to -437. The design estimated 390–430.
  Like Colorado's and Wyoming's, Utah's outline crosses the cell lines: 19 cells in row 147 and 9 in
  row 168. Sixteen cells with files lie outside coverage.
- **The borders:**
  - With Colorado: 18 cells are in both regions' coverage, all of them column -437, rows 147–164.
  - With Wyoming: 17 cells are in both.
  - The app reads both regions for a shared cell and dedupes features by `_osmId`.
- **The split threshold:** 8 of 433 cells split, around Salt Lake City and Provo (`160_-447`,
  `161_-447`, `161_-448`, `162_-448`, `162_-449`, `163_-448`, `164_-448`), plus `148_-455` in the
  south-west. The largest cell, `162_-448`, is 21.3 MiB before splitting. The largest file is one of
  its quarters, `utah/162_-448/325_-896.json`, at 7,558,476 bytes (about 7.2 MiB), well under the
  20 MiB guard. The threshold stays (ADR 0017).
- **Time:** Utah's job is the longest of the three, mostly the PBF download (1 min 27 s). The run
  took about 3 min 10 s from start to push, and the deploy job 34 s (the push 10 s). The site holds
  1,533 files, far under 19,000.

## Runs 6 and 7: 2026-11-13, `workflow_dispatch` on `main`, Idaho's first runs (change idaho-region)

**Run 6 (43362833261, at `5ef299e`): Idaho did not build.** Its job failed 1 s into the PBF
download: `download of https://download.geofabrik.de/north-america/us/idaho-latest.osm.pbf failed:
fetch failed`. Colorado, Wyoming and Utah downloaded from the same host in the same minute and built;
the deploy job left Idaho out ("no build this run and none before") and pushed nothing, the site
being unchanged. The cause wasn't logged; change download-cause-and-builder-heap makes the error
carry it (ADR 0031).

**Run 7 (43364250202, at `1f9e365`, the owner's one retry): all four built and Idaho is live.**
`data` = `750226d`; Geofabrik data of 2026-11-12 for all four.

| Measurement | Idaho |
|---|---|
| Matching nodes | 4,390 |
| Matching ways | 214,352 |
| Total bytes | 187,423,749 (about 179 MiB) |
| Largest cell before splitting | `174_-466` (Boise), 17,847,985 |
| Cells / split | 481 / 2 (`174_-466`, `174_-465`) |
| Files | 487; largest `idaho/174_-466/348_-931.json`, 5,489,292 bytes |
| Coverage cells | 469, rows 167–196, columns -469 to -445; 12 cells with files lie outside it |
| Artifact, zipped | 42,168,637 |
| Region job | 1 min 16 s, of which "Build the region" 57 s |

What the run confirms for Idaho:

- **The bounds guard passed** with 42.01 / -117.02 / 43.75 / -111.06 (ADR 0028). The design estimated
  436–470 coverage cells from a rough outline; the polygon gives 469.
- **49° N:** coverage reaches row 196 (49.0–49.25) through Geofabrik's margin: rows 195 and 196,
  columns -469 to -465.
- **The borders:** with Wyoming, 12 cells in both (column -445, rows 167–178); with Utah, 22 (row 167,
  columns -457 to -445; row 168, columns -453 to -445); `167_-445` and `168_-445` are in all three.
- **Time:** the run took about 4 min, set by Colorado's job (2 min 52 s); the deploy job 46 s (the
  push 14 s). The site holds 2,020 files.
