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
