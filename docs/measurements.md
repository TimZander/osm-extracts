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
  is the closest any file comes to the 20 MiB guard, about 70 % of it. Setting the threshold from
  this measurement is its own change.
- **Trails make up 99.5 % of the ways**, which is what drives the size (garmin-map ADR 0220's estimate
  was 120–250 MB).

Open questions for the owner, each with the assumption that holds until it is answered:

1. **A 14 MiB file is a heavy download on a phone.** The five largest files are 14.2, 7.3, 6.6, 6.1
   and 6.1 MiB. They are all in the Denver and Front Range quarters. A search there fetches up to
   four such quarters. *Assumption:* left as is until the owner decides. Options:
   - **Keep 4 MiB and accept the 14.2 MiB Denver quarter.** This needs no change. Every file is under
     the 20 MiB guard and garmin-map's 25 MiB body limit.
   - **One more split level, so no file is over about 5 MiB.** Split a quarter that is still over the
     threshold into 0.0625° cells. This needs a change to the consumer contract in garmin-map (one
     more level in `split`), a spec change here, and more files: about 4 for each such quarter. Seven
     files are over 5 MiB today.
   - **A lower threshold alone doesn't get there.** It splits more 0.25° cells, but the 14.2 MiB file
     is already a quarter, the smallest unit the format has. So a lower threshold works only together
     with another split level.
   - **Tighter categories.** Mapped sidewalks make up much of `highway=footway` in cities. Dropping
     `footway`, or keeping only footways that are named or tagged as a path, would shrink urban cells
     most. That changes what the import offers, a change in both repositories (ADR 0003).
   - **Compression.** Pages serves files with gzip or brotli to browsers that ask, so the bytes on the
     wire are likely 5–10 times smaller than the file. This is unmeasured: `osm.timzander.com` is
     blocked from the agent container. Measuring it, for example with
     `curl -sI -H 'Accept-Encoding: br, gzip' https://osm.timzander.com/colorado/158_-420/316_-839.json`,
     is the cheapest next step.
2. **The Pages deploy time.** Cloudflare posts no commit status. It does post a **check run**
   ("Cloudflare Pages", id 128282582824 on `9d56941`), readable through the public API
   (`/repos/TimZander/osm-extracts/commits/9d56941/check-runs`). That is where the "about 35 s
   from push to live" above comes from. Its start and finish are the same instant, so it gives no
   build time on its own. *Assumption:* push-to-check-run is a good enough measure while it stays
   far under the 20-minute limit. The dashboard's build log has the exact time if one is ever needed.
