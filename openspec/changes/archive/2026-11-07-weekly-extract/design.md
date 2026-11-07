# Design: weekly-extract

## Context

See proposal.md for the motivation. This repository is public, which gives it free GitHub-hosted runner
minutes, and it holds nothing but the pipeline. garmin-map is the consumer. Its `osm-import` spec fixes
the format this pipeline must produce: the manifest's keys and types, region and cell id syntax, the
0.25° grid with quarter splits, whole features, a 25 MiB limit on a file body, and the feature
properties it reads. Requirements here are written to produce exactly that format.

Constraints that shape the design:

- **Cloudflare Pages, static, free plan** (garmin-map ADR 0231): at most 20,000 files and 25 MiB per
  file per site, 500 builds a month, and a build (clone plus upload) times out after 20 minutes.
- **No Cloudflare credential in GitHub** (garmin-map ADR 0232). Pages' Git integration builds the
  `data` branch: production branch `data`, no build command, output `/`, preview branches off.
- **Owner-reported repository settings**: workflow permissions are read-only by default, and
  workflows from fork pull requests need approval. This session can't read either setting, so the
  attack test checks them by behaviour.
- **This build environment** blocks `download.geofabrik.de`, `*.pages.dev` and `osm.timzander.com`.
  Local runs use a small hand-written fixture. Real downloads happen only on GitHub's runners.

## Goals / Non-Goals

**Goals:** publish Colorado in the consumer's format, weekly; a run that fails in part leaves a working
site behind; the only credential anywhere is the deploy job's own `GITHUB_TOKEN`.

**Non-Goals:** coverage of states that aren't rectangles (open question 2); any region but Colorado;
keeping old weekly versions; a fallback host.

## Decisions

1. **The pipeline and its spec live here; the contract lives in garmin-map** (ADR 0001, from
   garmin-map ADRs 0228 and 0229). This spec states the format it produces; garmin-map's spec states
   what it accepts. A change to the format is a change in both repositories, consumer first.
2. **Plain GeoJSON on a 0.25° grid, dense cells split once into 0.125° quarters** (ADR 0002, from
   garmin-map ADRs 0220 and 0233). Pages answers a Range request with the whole file, so a single
   indexed archive won't do. A split cell always has all four quarter files, so the consumer needs no
   list of quarters.
3. **osmium-tool plus Node, with the category rules copied and pinned** (ADR 0003, from garmin-map ADR
   0223). The rules were copied from garmin-map commit `1a498d2fe984186328b2a9e6fc7e1ad232329952`
   (its `main` on 2026-11-07), which goes into `categoriesFrom`.
   - **Geometry from `add-locations-to-ways` OPL, not `osmium export`.** Tried locally on osmium
     1.16.0, the version Ubuntu 24.04 ships: `osmium export` turns a closed way tagged `area=yes` into a
     MultiPolygon whatever its config, so a closed footway would be lost. Instead `osmium tags-filter`
     selects the candidates, and `osmium add-locations-to-ways -f opl` writes each tagged node and each
     way with its vertex locations, one line each. Node parses those lines, decides the categories,
     and builds every geometry itself.
   - osmium only narrows the input. The Node classifier is what decides, so a node osmium keeps as a
     way vertex (a gate, say) is dropped unless it matches a category itself.
4. **Static Pages, deployed from an orphan `data` branch** (ADR 0004, from garmin-map ADRs 0231 and
   0232; R2 rejected for having no spending cap). Each run that changes something replaces `data` with
   one parentless commit, so the branch never grows history. Unchanged files keep their blobs.
5. **`_headers` and `404.html`** (ADR 0005, from garmin-map ADR 0234). This adds one refinement: Pages
   joins the values when two rules set the same header on a path, so a single `/*` rule with a
   `Cache-Control` would give `/manifest.json` two values. Instead, `Access-Control-Allow-Origin` goes
   on `/*`, and `Cache-Control` goes separately on `/:region/*`, `/LICENSE.txt` and `/manifest.json`.
   The result is the same headers ADR 0234 asks for, and no path gets a header twice.
6. **Regions: Colorado first, one entry at a time** (ADR 0006, from garmin-map ADR 0235).
   `regions.json` holds one entry per region (`id`, `name`, `geofabrik`, `bounds`, `clip`). A first
   `plan` job (`contents: read`) checks the list and outputs its ids as the region jobs' matrix, so a
   bad list stops the run before any download, and the matrix can't drift from the list. The matrix
   sets `fail-fast: false`, so one region's failure doesn't cancel the others.
7. **The workflow's security model** (ADR 0007, new here):
   - Triggers: `schedule` and `workflow_dispatch` with no inputs. A dispatch input would be text from
     whoever starts the run, and nothing needs one.
   - Top-level `permissions: contents: read`. Region jobs get `contents: read` and check out with
     `persist-credentials: false`. The deploy job alone gets `contents: write`. It also checks out with
     `persist-credentials: false`, and its push step hands the token to that one `git push` as an
     HTTP header in the step's environment, never in `.git/config`.
   - Actions: only GitHub's own (`checkout` v7.0.1, `upload-artifact` v7.0.2, `download-artifact`
     v8.0.2), each pinned by commit SHA. The pinned commits were resolved with `git ls-remote` on
     2026-11-07 and date from 2026-07-17 and 2026-10-07.
   - The draft allowed no action in the deploy job but `checkout`. This design adds `download-artifact`
     there. Its `github-token` input has no default, so for an artifact of the same run it uses only
     the runner's artifact token and never sees `GITHUB_TOKEN`. The alternative, fetching artifacts
     with `curl` from the REST API, would mean handing the token to more code.
   - No `${{ }}` inside `run:`: values reach scripts through `env:` and the matrix's region id. The
     scripts check every id against `[a-z0-9-]+` before using it.
   - The deploy job treats each region artifact as untrusted input. It checks the manifest entry's form,
     that the file set is exactly what the entry lists, that every file is a regular file under the
     region's folder, and the 20 MiB limit. Region jobs parse third-party data with third-party tools,
     so a compromised region job must not be able to plant `_headers`, `index.html` or a path outside
     its folder.
   - One concurrency group (`osm-extract`, no cancel-in-progress), and the push uses
     `--force-with-lease` against the `data` commit the job started from.
8. **The deploy job assembles from the previous `data` tree**, which is public. It reads the tree with
   a plain `git fetch` and `git archive`; the token isn't needed to read it. A previous manifest that is
   present but invalid fails the run: guessing at it could drop files a page is still reading. A tree
   with no `manifest.json`, like today's placeholder, counts as having no previous regions.
9. **Node comes from the runner image** (`ubuntu-24.04`), not `actions/setup-node`. That action
   takes `github.token` by default, and in the deploy job that token can write. The scripts need only
   `fetch` and `node:test`, and they fail at start on a Node older than 20.
10. **Rounding is done on the decimal string.** OPL writes coordinates as decimals with at most seven
   places. The writer rounds those digits, halves away from zero, without going through binary floating
   point, so a tie is rounded the same way on every machine.
11. **Downloads in Node** (`fetch` to a file, MD5 with `node:crypto`), with osmium run through
   `execFile`, never a shell. The region job is one Node entry point, so the fixture test can drive the
   same code with local files in place of downloads.

## Risks / Trade-offs

- **The 20-minute Pages build limit** → regions are added one at a time, and output is byte-stable, so
  unchanged files keep their hashes. Whether Pages skips files it already holds is likely but
  unverified. The first run measures the deploy time. If it can't finish within 20 minutes, the
  fallback (`wrangler pages deploy` with a Pages token as a secret) needs its own ADR and the owner's
  decision first.
- **The deploy job's token can write the whole repository, `main` included** → nothing a fork can
  cause runs the workflow; only one job has `contents: write`; it runs only repository code, `checkout`
  and `download-artifact`; and the token is used by `checkout` and the `git push` alone. Anyone with
  write access could already push to `main`, so `workflow_dispatch` from a branch gives them nothing
  new.
- **osmium parses untrusted PBF data** → it runs only in region jobs, which hold no write credential,
  and their output is checked by the deploy job.
- **A cell near the split threshold may flip between whole and split from week to week** → last run's
  files stay for one more run.
- **The category rules are written twice** → `categoriesFrom` names the commit they came from; a test
  pins the rules to the copied table.
- **A fork pull request that edits the workflow.** GitHub runs a `pull_request` workflow from the PR's
  own files, so a fork could add `on: pull_request`. What stops it is the owner-reported setting that
  fork workflows need approval, plus GitHub's rule that a fork's run gets a read-only token and no
  secrets. Even an approved run like that can't write `data`. The attack test checks this by
  behaviour, since this session can't read the setting.
- **One `categoriesFrom` for all regions.** A failed region keeps an entry built earlier, maybe under
  older rules. That is accepted while the rules change rarely and only in step with garmin-map.
- **An `.md5` from the same host checks integrity, not authenticity** → accepted: Geofabrik is the
  source in any case, and it is fetched over HTTPS.

## Migration Plan

1. Merging this change is the owner's go to publish. GitHub only lets a workflow be dispatched once
   its file is on the default branch, and merging also arms the weekly schedule. So the PR waits
   unmerged until the owner (relayed by the coordinator) is ready for the first publish.
2. Right after the merge, a `workflow_dispatch` run publishes, replacing the placeholder `data`
   branch, rather than waiting for Monday. Its measurements are recorded after merge (Workflow
   follow-up).
3. Rollback: disable the workflow. The last `data` commit stays live. No other state exists.

## Open Questions

Each comes with the assumption this change proceeds on. The owner's answers become ADRs.

1. **The split threshold.** *Assumption:* 4 MiB (4,194,304 bytes), until the first Colorado run
   measures the cells (garmin-map ADR 0233, open question 13). The value is one constant.
2. **Coverage of states that aren't rectangles** (garmin-map open question 12). *Assumption:* it waits
   for a follow-up change in both repositories. Until then, only rectangular regions are added.
3. **Region order after Colorado.** *Assumption:* the owner's call. This change lists only `colorado`.
4. **Colorado's `bounds`.** *Assumption:* the state's bounding box, `south 37, west -109.06, north 41,
   east -102.04`. The polygon check in the first run either confirms it or fails the region, naming it.
5. **The schedule.** *Assumption:* Mondays at 05:23 UTC. Geofabrik's daily files are usually out by
   then, and a minute off the hour avoids the top-of-hour rush.
6. **Is Colorado clipped?** *Assumption:* no. Clipping is for regions cut out of a larger extract
   (southern Alberta and British Columbia, garmin-map ADR 0235). Geofabrik's Colorado polygon reaches
   a little past the state line, so some edge cells outside `bounds` hold neighbouring data. The
   consumer never reads them for an area inside `bounds`, and they cost a few dozen files. Setting
   `clip` to `true` in `regions.json` would drop them.
7. **Guard margins and retention.** *Assumption:* 20 MiB per file and 19,000 files per site, each
   below Pages' limit (25 MiB, 20,000) with room for a regenerated tree, as garmin-map's design
   assumed (its open question 6). Artifacts are kept for one day, since the deploy job reads them
   minutes later.
8. **Scheduled runs and inactivity.** GitHub disables a public repository's scheduled workflows
   after 60 days without repository activity. Whether the deploy job's own pushes to `data` count is
   unconfirmed. *Assumption:* accepted; GitHub emails the owner before it disables the schedule, and
   re-enabling it is one click. No keep-alive commit.
9. **Builder-chosen details** (ADRs 0001–0007, the sort order, the file layout, the `_headers` split
   in decision 5, and the job time limits). *Assumption:* they stand unless the owner overrides one in PR review.
