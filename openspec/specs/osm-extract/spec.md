# osm-extract Specification

## Purpose
Builds a static, regional extract of the OpenStreetMap features garmin-map's import offers, rebuilds
it on a schedule, and publishes it as a static Cloudflare Pages site that the app reads cross-origin,
with no Cloudflare credential in GitHub.

## Requirements

### Requirement: The extract is rebuilt weekly and on demand

A workflow SHALL rebuild every region in the regions list once a week on a `schedule`, and when the
owner starts it by hand (`workflow_dispatch`, with no inputs), each region from its Geofabrik
`<path>-latest.osm.pbf`.

#### Scenario: A weekly run

- **WHEN** the weekly schedule fires
- **THEN** the workflow builds every region in the regions list

#### Scenario: A run started by hand

- **WHEN** the owner starts the workflow from the Actions tab
- **THEN** it builds every region in the regions list, and asks for no input

### Requirement: Nothing a pull request or a fork can cause runs the workflow

The extract workflow's only triggers SHALL be `schedule` and `workflow_dispatch`, so nothing that
someone without write access can cause (a pull request from a fork or a branch, `pull_request_target`,
`workflow_run`, a push, a comment) starts it.

#### Scenario: A pull request from a fork

- **WHEN** someone opens a pull request from a fork
- **THEN** no job of the extract workflow runs

#### Scenario: A pull request that edits the workflow

- **WHEN** a pull request changes the workflow's triggers to run on `pull_request`
- **THEN** any run it causes holds no token that can write, and the `data` branch doesn't change

#### Scenario: Reading the workflow file

- **WHEN** the workflow file is read
- **THEN** its `on:` has exactly the keys `schedule` and `workflow_dispatch`

### Requirement: The regions list

The regions list SHALL be one file holding at least one entry, each with exactly: `id` (one or more of
`a`–`z`, `0`–`9` and `-`, unique), `name` (not blank), `geofabrik` (a path of such segments joined by
`/`), `bounds` (exactly `south` below `north`, `west` below `east`, within ±90 and ±180) and `clip`
(true or false). A first job SHALL check the list
and give the region jobs their ids, one job each, so a list breaking any of these rules fails the run
before any region job starts.

#### Scenario: Colorado alone

- **WHEN** the regions list holds only `colorado`
- **THEN** the workflow runs one region job, for `colorado`

#### Scenario: A bad region id

- **WHEN** an entry's `id` is `../evil`
- **THEN** the run fails before any region job starts, naming the entry

#### Scenario: A Geofabrik path that is a URL

- **WHEN** an entry's `geofabrik` is `https://evil.example/x`
- **THEN** the run fails before any region job starts, naming the entry

#### Scenario: Colorado and Wyoming

- **WHEN** the regions list holds `colorado`, then `wyoming`
- **THEN** the workflow runs two region jobs, one for each, and a run in which both build publishes a manifest whose `regions` are `colorado` then `wyoming`

#### Scenario: Colorado, Wyoming and Utah

- **WHEN** the regions list holds `colorado`, then `wyoming`, then `utah`
- **THEN** the workflow runs three region jobs, one for each, and a run in which all three build publishes a manifest whose `regions` are `colorado`, `wyoming`, then `utah`

### Requirement: The import's categories

The categories, in catalog order, SHALL be: on nodes, `peaks` (`natural=peak`), `passes`
(`mountain_pass=yes` or `natural=saddle`), `huts` (`tourism=alpine_hut|wilderness_hut` or
`amenity=shelter`), `hot_springs` (`natural=hot_spring`), `trailheads` (`highway=trailhead`) and
`parking` (`amenity=parking`); on ways, `trails` (`highway=path|footway|track|bridleway`) and `ridges`
(`natural=ridge`).

#### Scenario: A shelter

- **WHEN** a node is tagged `amenity=shelter`
- **THEN** its feature's `_osmCategories` is `["huts"]`

#### Scenario: A ridge that is also a track

- **WHEN** a way is tagged `highway=track` and `natural=ridge`
- **THEN** its feature's `_osmCategories` is `["trails", "ridges"]`

### Requirement: The extract holds exactly what the import's categories select

A region's extract SHALL hold every OSM node, and every way with at least two located vertices, of its
source (after clipping, for a clipped region) that matches one of the import's categories, and nothing
else.

#### Scenario: A peak

- **WHEN** node 101 is tagged `natural=peak` and `name=Example Peak`
- **THEN** the extract holds a feature for `node/101`

#### Scenario: A road

- **WHEN** a way is tagged `highway=residential`
- **THEN** the extract holds no feature for it

#### Scenario: A node tagged like a trail

- **WHEN** a node is tagged `highway=path`
- **THEN** the extract holds no feature for it

#### Scenario: A way with one located vertex

- **WHEN** a way tagged `highway=path` has only one vertex whose location is known
- **THEN** the extract holds no feature for it

### Requirement: Each feature's form

Each feature SHALL be a GeoJSON Feature whose geometry is a Point (a node) or a LineString (a way, its
located vertices in way order, a closed way staying a LineString whatever its other tags), with exactly
the properties `title` (the `name` tag, or `""`), `_osmCategories` (every matching category id, in the
catalog order above) and `_osmId` (`node/<id>` or `way/<id>`).

#### Scenario: A node in two categories

- **WHEN** node 303 is tagged `natural=peak` and `mountain_pass=yes`
- **THEN** its feature has `_osmCategories` `["peaks", "passes"]` and `_osmId` `node/303`

#### Scenario: A closed footway marked as an area

- **WHEN** way 201 is tagged `highway=footway` and `area=yes` and its first and last vertex are the same node
- **THEN** its feature is a LineString whose first and last coordinates are equal

#### Scenario: An unnamed trail

- **WHEN** a way tagged `highway=track` has no `name` tag
- **THEN** its feature's `title` is `""`, and it has no other OSM tag as a property

### Requirement: The category rules name the garmin-map commit they were copied from

The category rules SHALL be a copy of garmin-map's, and the manifest's `categoriesFrom` SHALL be the
full garmin-map commit SHA they were copied from. Changing the rules is a change in both repositories.

#### Scenario: The manifest names the source of the rules

- **WHEN** a run publishes
- **THEN** `manifest.json` has `categoriesFrom` set to a 40-character garmin-map commit SHA

### Requirement: Coordinates are rounded to six decimals

Every coordinate written SHALL be the source coordinate, as a decimal, rounded to six decimal places,
halves away from zero, and written as the shortest JSON number that reads back as that value.

#### Scenario: Rounding

- **WHEN** a node is at latitude 39.6249996, longitude -106.062
- **THEN** its coordinates are written `[-106.062,39.625]`

#### Scenario: A tie

- **WHEN** a node is at latitude 39.6249995, longitude -106.0000005
- **THEN** its coordinates are written `[-106.000001,39.625]`

### Requirement: Features are filed into 0.25° cells

Each region SHALL be written as one FeatureCollection per 0.25° cell at `<region>/<row>_<col>.json`,
where `row = floor(lat × 4)` and `col = floor(lon × 4)` of the rounded coordinate, written as integers
with no `+`, no leading zero and no `-0`. A feature SHALL go, whole, into every cell holding one of its
vertices. A cell with no feature SHALL not be written.

#### Scenario: A point's cell

- **WHEN** a node is written at `[-106.062,39.625]`
- **THEN** it is in `colorado/158_-425.json`

#### Scenario: A trail across a cell edge

- **WHEN** a trail has vertices in cells `158_-425` and `158_-424`
- **THEN** both files hold the whole trail

#### Scenario: An empty cell

- **WHEN** no feature has a vertex in cell `160_-420`
- **THEN** no file is written for it, and the manifest's `cells` and `split` don't list it

### Requirement: A dense cell is split into its four quarters

A cell whose whole file would be larger than the split threshold, 4 MiB (4,194,304 bytes; open
question 1 in the design), SHALL instead be written as all four
of its 0.125° quarters, empty ones included, at `<region>/<row>_<col>/<qrow>_<qcol>.json`, where
`qrow = floor(lat × 8)` and `qcol = floor(lon × 8)`. Each quarter SHALL hold, whole, every feature with
a vertex in it. The cell's own file SHALL not be written.

#### Scenario: A cell over the threshold

- **WHEN** cell `158_-425` would be 5 MiB
- **THEN** it is written as `colorado/158_-425/316_-850.json`, `316_-849.json`, `317_-850.json` and `317_-849.json`, and `colorado/158_-425.json` is not written

#### Scenario: A cell exactly at the threshold

- **WHEN** cell `158_-424` would be exactly 4,194,304 bytes
- **THEN** it is written whole, as `colorado/158_-424.json`

#### Scenario: An empty quarter

- **WHEN** a split cell has no feature in its quarter `317_-850`
- **THEN** `colorado/158_-425/317_-850.json` is written as a FeatureCollection with no features

### Requirement: The output is byte-stable

Every region file SHALL be a function of its features alone: features sorted nodes before ways, each
by ascending numeric id; keys in the order `type`, `features` / `type`, `geometry`, `properties` /
`type`, `coordinates` / `title`, `_osmCategories`, `_osmId`; one feature per line; a final newline. The
manifest's `cells`, `split` and `coverage` SHALL be sorted numerically by row, then by column.

#### Scenario: The same data built twice

- **WHEN** the same source data is built twice
- **THEN** every file of the two builds is byte-identical

#### Scenario: Sort order

- **WHEN** a cell holds `way/5`, `node/20` and `node/3`
- **THEN** its features are in the order `node/3`, `node/20`, `way/5`

#### Scenario: Cell order

- **WHEN** a region writes cells `159_-425`, `158_-424`, `158_-425` and `-1_3`
- **THEN** its `cells` is `["-1_3", "158_-425", "158_-424", "159_-425"]`

#### Scenario: Coverage order

- **WHEN** a region covers cells `159_-425`, `158_-424` and `158_-425`, or its artifact's entry lists them in that order
- **THEN** the manifest's `coverage` for it is `["158_-425", "158_-424", "159_-425"]`

### Requirement: The manifest describes every region

`manifest.json` SHALL be a JSON object with `attribution` (`© OpenStreetMap contributors (ODbL)`),
`categoriesFrom`, and `regions`: one object per published region, in regions-list order, with `id`,
`name`, `bounds` (`south`, `west`, `north`, `east`, numbers), `dataDate` (`YYYY-MM-DD`), `cells` (the
region's cell ids), `split` (the ids of its split cells, possibly empty) and `coverage` (its
covered cells' ids, each once; absent only from a kept entry). garmin-map's `osm-import` reads it.

#### Scenario: A Colorado run

- **WHEN** a run builds `colorado`, named `Colorado`, from data dated 2026-10-28
- **THEN** the manifest's `regions` holds one object with `id` `colorado`, `name` `Colorado`, the listed `bounds`, `dataDate` `2026-10-28`, `cells`, `split` and `coverage`

#### Scenario: A border cell in two regions

- **WHEN** a run builds `colorado` and `utah`, both their artifacts list cell `152_-437` in `cells` and `coverage`, and each holds a file for it with the same trail
- **THEN** the manifest lists `152_-437` in both regions' `cells` and `coverage`, and both `colorado/152_-437.json` and `utah/152_-437.json` are published with that trail

### Requirement: The manifest lists exactly the files written

A region's `cells` SHALL list exactly the cells written under its folder, whole or split, and its
`split` exactly those written as quarters. Each listed cell SHALL have its file, or all four of its
quarter files.

#### Scenario: One cell split

- **WHEN** a region writes `158_-424.json` whole and `158_-425` as four quarters
- **THEN** its `cells` is `["158_-425", "158_-424"]` and its `split` is `["158_-425"]`

### Requirement: The data date is the source's replication time

A region's `dataDate` SHALL be the UTC date of its source PBF header's `osmosis_replication_timestamp`.
A PBF without that timestamp SHALL fail the region's job.

#### Scenario: A dated file

- **WHEN** the PBF header's replication timestamp is `2026-10-28T20:21:02Z`
- **THEN** the region's `dataDate` is `2026-10-28`

#### Scenario: An undated file

- **WHEN** the PBF header has no replication timestamp
- **THEN** the region's job fails, and nothing of that region changes

### Requirement: A region's bounds lie inside its Geofabrik polygon

A region's `bounds` SHALL lie wholly inside its Geofabrik extract polygon (`<path>.poly`, every ring,
holes included), so every area inside `bounds` has data: each corner inside the polygon, no ring edge
touching or crossing the rectangle's edges, and no ring vertex inside it. A point on a ring counts as
outside. Otherwise the region's job SHALL fail before its files are built, naming the region.

#### Scenario: Bounds reaching outside

- **WHEN** a region's `bounds` has a corner outside its Geofabrik polygon
- **THEN** the region's job fails naming the region, and nothing of that region changes

#### Scenario: Bounds inside

- **WHEN** a region's `bounds` lie inside its polygon, clear of every ring
- **THEN** the region builds

#### Scenario: A notch in the polygon

- **WHEN** every corner of a region's `bounds` is inside its polygon, but the polygon has a notch that cuts into the rectangle
- **THEN** the region's job fails naming the region

#### Scenario: A hole in the polygon

- **WHEN** the polygon has a hole that lies inside the region's `bounds`
- **THEN** the region's job fails naming the region

### Requirement: A clipped region is cut to its bounds

A region marked clipped SHALL be cut to its `bounds` before its features are selected, keeping every
way with a node inside the bounds whole, and SHALL hold no point feature outside its `bounds`, so its
cells lie within its `bounds` apart from the parts of those ways.

#### Scenario: A clipped region

- **WHEN** a clipped region's source holds a peak north of its `bounds`
- **THEN** the extract doesn't hold that peak

#### Scenario: A peak on a kept trail

- **WHEN** a peak north of a clipped region's `bounds` is a vertex of a trail that enters the `bounds`
- **THEN** the extract holds the whole trail and not the peak

### Requirement: A failed or corrupt download publishes nothing new for the region

A region's job SHALL fail, and nothing of that region SHALL change, when the download of its PBF, its
`.md5` or its polygon fails, or the PBF's MD5 differs from the `.md5`.

#### Scenario: The checksum can't be fetched

- **WHEN** the `.md5` download answers 404
- **THEN** the region's job fails, and nothing of that region changes

#### Scenario: An MD5 mismatch

- **WHEN** the downloaded PBF's MD5 differs from Geofabrik's `.md5`
- **THEN** the region's job fails, none of its files change, and the manifest keeps its previous entry for it

### Requirement: No published file is over 20 MiB

A region whose files include one larger than 20 MiB (20,971,520 bytes) SHALL fail its job, naming the
file and its size, and nothing of that region SHALL change.

#### Scenario: A 21 MiB quarter

- **WHEN** a region writes a 21 MiB file
- **THEN** its job fails naming the file and its size, and nothing of that region changes

### Requirement: The site holds at most 19,000 files

The deploy job SHALL push nothing when the assembled site holds more than 19,000 files, failing with
the file count of each region and of the whole site.

#### Scenario: Too many files

- **WHEN** the assembled site would hold 19,500 files
- **THEN** the deploy job fails naming the counts, and `data` is not pushed

### Requirement: Every job has a time limit

The plan job SHALL be stopped after 5 minutes, a region job after 120 minutes and the deploy job after
30 minutes. A region job stopped this way SHALL count as a failed region.

#### Scenario: A region job that runs too long

- **WHEN** a region job is still building after 120 minutes
- **THEN** it is stopped, it uploads no artifact, and the deploy job keeps that region's previous files

### Requirement: A region job hands its tree to the deploy job and writes nothing

Each region's job SHALL build its tree and manifest entry and, as its last step, hand them to the
deploy job as an Actions artifact named for the region, kept for one day; a region counts as
succeeded exactly when its artifact exists. No region job SHALL write the repository. The deploy job
SHALL run after every region job ends, unless the run was cancelled or the regions list failed.

#### Scenario: Two regions

- **WHEN** two regions build in parallel
- **THEN** the manifest lists both, written once, by the deploy job

#### Scenario: A bad regions list

- **WHEN** the regions list fails its checks
- **THEN** no region job and no deploy job runs

#### Scenario: A cancelled run

- **WHEN** the owner cancels a run while a region job is building
- **THEN** the deploy job doesn't run, and `data` doesn't change

### Requirement: The deploy job accepts only well-formed region trees

The deploy job SHALL use a region's artifact only when the region is in the regions list, it has one
artifact, its entry has the manifest's form with `id`, `name` and `bounds` equal to the list's and a non-empty
`coverage` of distinct cell ids, and its files are exactly the files of the cells its `cells` lists, as regular files under its folder, each
at most 20 MiB. Otherwise it SHALL fail without pushing, naming the region: a malformed artifact is
not treated as a failed region.

#### Scenario: A stray file in an artifact

- **WHEN** a region's artifact also holds `_headers` or `colorado/../index.html`
- **THEN** the deploy job fails naming the region, and `data` is not pushed

#### Scenario: An artifact that changes the bounds

- **WHEN** the `colorado` artifact's entry has `bounds` other than the regions list's
- **THEN** the deploy job fails naming the region, and `data` is not pushed

#### Scenario: An artifact for a region not on the list

- **WHEN** the run holds an artifact for `utah` and the list has no `utah`
- **THEN** the deploy job fails naming it, and `data` is not pushed

#### Scenario: A listed cell with no file

- **WHEN** a region's entry lists cell `158_-425` in `cells` and its artifact has no file for it
- **THEN** the deploy job fails naming the region, and `data` is not pushed

#### Scenario: An artifact without coverage

- **WHEN** a region's entry has no `coverage`, an empty one, or one holding `../x`, `1_2_3`, `01_3` or the same id twice
- **THEN** the deploy job fails naming the region, and `data` is not pushed

### Requirement: A failed region keeps its previous files

When a region's job fails, the other region jobs SHALL run to the end, the deploy job SHALL still
publish the regions that succeeded, and it SHALL keep the failed region's previous manifest entry and
every file it lists from the previous `data` tree, the entry's `coverage` (or lack of one) included.
A failed region that was never published, and a region no longer in the regions list, SHALL be left
out of the manifest.

#### Scenario: One region fails

- **WHEN** `colorado` published last week and its job fails this week
- **THEN** the new manifest holds last week's `colorado` entry, and every file it lists is in the new tree

#### Scenario: A region taken off the list

- **WHEN** `utah` was in last run's manifest and is no longer in the regions list
- **THEN** the new manifest has no `utah` entry, and this run's tree still holds the files last run's manifest listed for it

#### Scenario: A kept entry and its coverage

- **WHEN** `colorado`'s job fails, and last week's `colorado` entry has a `coverage`, or has none because it was built before `coverage` existed
- **THEN** the new manifest's `colorado` entry has the same `coverage` ids, sorted, or none

### Requirement: The previous site is read from the data branch

The deploy job SHALL read the previous site from the `data` branch's tree; no `data` branch, or a tree
with no `manifest.json`, counts as no previous regions. A failed read of the branch, a `manifest.json`
not of the form garmin-map's `osm-import` accepts or with an entry whose `coverage` is present but not
an array of distinct cell ids, a listed file the tree doesn't hold, or a symbolic link anywhere in the tree
SHALL fail the deploy job without pushing.

#### Scenario: The placeholder branch

- **WHEN** `data` holds only `index.html` and `404.html`
- **THEN** the run publishes as if there were no previous regions

#### Scenario: A broken previous manifest

- **WHEN** the previous `manifest.json` is not valid JSON
- **THEN** the deploy job fails saying so, and `data` is not pushed

#### Scenario: A symbolic link in the previous tree

- **WHEN** the previous `data` tree holds `colorado` as a symbolic link
- **THEN** the deploy job fails naming it, and `data` is not pushed

#### Scenario: A broken previous coverage

- **WHEN** the previous manifest's `colorado` entry has `coverage` `"all"`, or a `coverage` holding `../x` or the same id twice
- **THEN** the deploy job fails saying so, and `data` is not pushed

### Requirement: The site holds only the extract's files

The assembled tree SHALL hold only `manifest.json`, `_headers`, `404.html`, `LICENSE.txt`, and the
region files these requirements place there. No other file from the previous tree SHALL be kept.

#### Scenario: The placeholder page goes

- **WHEN** the previous `data` tree holds `index.html`
- **THEN** the new tree doesn't

### Requirement: Files dropped from the manifest stay one more run

The new tree SHALL also hold every file the previous manifest listed that the new manifest doesn't,
copied from the previous `data` tree, so a page holding the old manifest still finds its files. Files
no manifest listed in the previous run SHALL not be carried over.

#### Scenario: A cell that became split

- **WHEN** `158_-425` was whole last run and is split this run
- **THEN** this run's tree holds `colorado/158_-425.json` as well as its four quarters

#### Scenario: Two runs later

- **WHEN** a cell left the manifest in the previous run
- **THEN** this run's tree no longer holds its file

### Requirement: Publishing replaces the site with one orphan commit

The deploy job SHALL commit the assembled tree as one commit with no parent and force-push it to
`data`, but only when its manifest lists a region (checked before the trees are compared; if none,
the job succeeds unpushed) and the tree differs from the previous `data` tree. A site without a
manifest of the manifest's form SHALL fail the job unpushed. Runs SHALL share one concurrency group
without cancelling a run in progress, so two runs never publish at once.

#### Scenario: A changed tree

- **WHEN** the assembled tree differs from the previous `data` tree, and its manifest lists a region
- **THEN** `data` becomes one commit with no parent whose tree is the assembled tree

#### Scenario: Nothing changed

- **WHEN** the assembled tree equals the previous `data` tree, and its manifest lists a region
- **THEN** nothing is pushed, and the log says so

#### Scenario: No region at all

- **WHEN** every region job fails and the previous site lists no region, so the new manifest lists none (whether or not the tree changed)
- **THEN** nothing is pushed, the log says the manifest lists no region, the deploy job succeeds, and `data` stays as it was

#### Scenario: No valid manifest

- **WHEN** the assembled site's `manifest.json` is missing, isn't valid JSON, or is `{}`
- **THEN** the deploy job fails, and nothing is pushed

#### Scenario: The push fails

- **WHEN** the push is rejected
- **THEN** the job fails, and the previous site and every file its manifest lists stay as they were

### Requirement: The site sets its CORS and cache headers

The site SHALL carry a `_headers` file that gives every path `Access-Control-Allow-Origin: *`, the
region files and `LICENSE.txt` `Cache-Control: public, max-age=3600`, and `/manifest.json`
`Cache-Control: public, max-age=300`, with no path given two `Cache-Control` values.

#### Scenario: The manifest's cache time

- **WHEN** the `_headers` rules are applied to `/manifest.json`
- **THEN** it gets `Access-Control-Allow-Origin: *` and the single `Cache-Control: public, max-age=300`

#### Scenario: A cell's cache time

- **WHEN** the rules are applied to `/colorado/158_-425/316_-849.json`
- **THEN** it gets `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600`

### Requirement: A missing file is a real 404

The site SHALL carry a top-level `404.html`, a short plain page, so that Pages answers a missing path
with `404` rather than with the site's root page.

#### Scenario: The 404 page

- **WHEN** a run publishes
- **THEN** the tree holds `404.html`

### Requirement: The extract carries its licence notice

The site SHALL carry `LICENSE.txt`, stating that the data is © OpenStreetMap contributors and offered
under the ODbL 1.0 as a derived database, derived from Geofabrik's download of each region, with each
region's data date, and linking this repository as the source of the derivation.

#### Scenario: Reading the licence

- **WHEN** someone opens `LICENSE.txt` after a Colorado run on data dated 2026-10-28
- **THEN** it names OpenStreetMap contributors, the ODbL 1.0, Geofabrik, `Colorado` with `2026-10-28`, and `https://github.com/TimZander/osm-extracts`

### Requirement: Only the deploy job can write the repository

The workflow's top-level `permissions` SHALL be `contents: read` alone. Region jobs SHALL have
`contents: read` alone and check out with `persist-credentials: false`. Only the deploy job SHALL have
`contents: write`; its token SHALL be passed to no step but its checkout and its push, and SHALL
not be stored in the git config.

#### Scenario: Reading the permissions

- **WHEN** the workflow file is read
- **THEN** only the deploy job has `contents: write`, and no job has any other write permission

#### Scenario: Where the token goes

- **WHEN** the workflow file is read
- **THEN** `github.token` appears only in the `env` of the deploy job's push step, and every checkout sets `persist-credentials: false`

#### Scenario: A compromised region job

- **WHEN** code in a region job tries to push
- **THEN** it holds no credential that can push

### Requirement: The workflow uses no secret and only pinned actions

The workflow SHALL reference no repository secret and no Cloudflare credential, and SHALL not set
`ACTIONS_STEP_DEBUG`. Every action it uses SHALL be one of GitHub's own `actions/*`, pinned by full
commit SHA. No `${{ }}` expression SHALL appear inside a `run:` script.

#### Scenario: Reading the workflow's actions

- **WHEN** the workflow file is read
- **THEN** every `uses:` is `actions/<name>@<40-hex SHA>`, no `secrets.` reference appears, and `ACTIONS_STEP_DEBUG` appears nowhere

### Requirement: Each region job reports its size

Each region's job SHALL report, in its log and job summary, its matching node and way counts, total
bytes written, its largest 0.25° cell before splitting (id and bytes), its cell, split-cell, file and
coverage-cell counts.

#### Scenario: The Colorado report

- **WHEN** the `colorado` job finishes building
- **THEN** its job summary shows those numbers for `colorado`

### Requirement: The bounds guard names the first failing point

When a region's `bounds` fail the polygon check, the job's error SHALL name the region and the first
failure, in this order: a corner (south-west, south-east, north-east, north-west) outside the polygon
or on a ring, as "outside the polygon"; then a ring vertex inside the rectangle; then a ring edge
meeting the rectangle's edges, by its two ends. Rings and their points go in `.poly` order.

#### Scenario: A corner outside

- **WHEN** region `sample`'s `bounds` are south 39, west -108, north 40, east -105, and its polygon's west edge is at -107.5
- **THEN** the job fails with a message naming `sample` and its south-west corner `(39, -108)` as outside the polygon

#### Scenario: A ring vertex inside

- **WHEN** region `sample`'s `bounds` are south 39, west -108, north 40, east -105, every corner is inside its polygon, and a notch puts a ring vertex at latitude 39.5, longitude -105.5
- **THEN** the job fails with a message naming `sample` and the ring vertex `(39.5, -105.5)` as inside the bounds

#### Scenario: A ring edge crossing

- **WHEN** region `sample`'s `bounds` are south 39, west -108, north 40, east -105, every corner is inside, no ring vertex is inside, and a ring edge from `(38, -106)` to `(41, -106.2)` crosses the bounds
- **THEN** the job fails with a message naming `sample` and the ring edge from `(38, -106)` to `(41, -106.2)`

#### Scenario: How points are written

- **WHEN** the guard names any point
- **THEN** it is written `(lat, lon)`, each the shortest decimal that reads back as the value

### Requirement: Each region lists the cells it covers

The entry an unclipped region's job builds SHALL have `coverage`: the id, once each, of every 0.25°
cell (as in "Features are filed into 0.25° cells") sharing more than 1e-12 square degrees of area
with the inside of the region's Geofabrik polygon, as read (every ring, holes cut out), whether or
not the cell has a file. So a cell the polygon meets only along an edge or at a corner is not listed. Coverage
SHALL not depend on the region's features.

#### Scenario: A polygon on cell lines

- **WHEN** a region's polygon is the rectangle from latitude 38.5 to 41.5 and longitude -107.5 to -104.5
- **THEN** its `coverage` is exactly the 144 cells of rows 154 to 165 and columns -430 to -419

#### Scenario: A covered cell with no feature

- **WHEN** cell `160_-420` lies inside a region's polygon and no feature has a vertex in it
- **THEN** its `coverage` lists `160_-420`, its `cells` doesn't, and no file is written for it

#### Scenario: A polygon that cuts through a cell

- **WHEN** a region's polygon covers a sliver along the south edge of cell `164_-425`
- **THEN** its `coverage` lists `164_-425`

#### Scenario: A polygon that meets a cell only along its edge

- **WHEN** a region's polygon lies south of latitude 41.0 and has an edge along it
- **THEN** its `coverage` lists no cell of row 164

#### Scenario: A polygon that meets a cell only at a corner

- **WHEN** a region's polygon is the rectangle from latitude 40.0 to 40.25 and longitude -105.0 to -104.75, so it meets cell `161_-419` only at its corner (40.25, -104.75)
- **THEN** its `coverage` is `["160_-420"]`

#### Scenario: A hole that holds a whole cell

- **WHEN** a region's polygon has a hole that holds all of cell `160_-420`
- **THEN** its `coverage` doesn't list `160_-420`

#### Scenario: A trail that leaves the polygon

- **WHEN** a region's source holds a trail with a vertex in cell `166_-425`, which its polygon doesn't cover
- **THEN** its `cells` lists `166_-425` and its file is written, and its `coverage` doesn't list it

### Requirement: A clipped region covers its bounds' cells

The entry a clipped region's job builds SHALL have as `coverage` the id, once each, of every 0.25° cell sharing more than
1e-12 square degrees of area with its `bounds`, whatever its polygon: a cell the rectangle meets only
along an edge or at a corner is not covered.

#### Scenario: A clipped region

- **WHEN** a clipped region's `bounds` are south 39.1, west -105.6, north 39.5, east -105.0
- **THEN** its `coverage` is the cells of rows 156 to 157 and columns -423 to -421
