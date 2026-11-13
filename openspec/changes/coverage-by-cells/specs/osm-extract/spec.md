## ADDED Requirements

### Requirement: Each region lists the cells it covers

An unclipped region's manifest entry SHALL have `coverage`: the id, once each, of every 0.25° cell
(as in "Features are filed into 0.25° cells") sharing more than 1e-12 square degrees of area with
the inside of the region's Geofabrik polygon (every ring, holes cut out), whether or not the cell
has a file. So a cell the polygon meets only along an edge or at a corner is not listed. Coverage
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

A clipped region's `coverage` SHALL be the id, once each, of every 0.25° cell sharing more than
1e-12 square degrees of area with its `bounds`, whatever its polygon: a cell the rectangle meets only
along an edge or at a corner is not covered.

#### Scenario: A clipped region

- **WHEN** a clipped region's `bounds` are south 39.1, west -105.6, north 39.5, east -105.0
- **THEN** its `coverage` is the cells of rows 156 to 157 and columns -423 to -421

## MODIFIED Requirements

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

### Requirement: The manifest describes every region

`manifest.json` SHALL be a JSON object with `attribution` (`© OpenStreetMap contributors (ODbL)`),
`categoriesFrom`, and `regions`: one object per published region, in regions-list order, with `id`,
`name`, `bounds` (`south`, `west`, `north`, `east`, numbers), `dataDate` (`YYYY-MM-DD`), `cells` (the
region's cell ids), `split` (the ids of its split cells, possibly empty) and `coverage` (its
covered cells' ids, each once; absent only from a kept entry). garmin-map's `osm-import` reads it.

#### Scenario: A Colorado run

- **WHEN** a run builds `colorado`, named `Colorado`, from data dated 2026-10-28
- **THEN** the manifest's `regions` holds one object with `id` `colorado`, `name` `Colorado`, the listed `bounds`, `dataDate` `2026-10-28`, `cells`, `split` and `coverage`

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

### Requirement: The deploy job accepts only well-formed region trees

The deploy job SHALL use a region's artifact only when the region is in the regions list, it has one
artifact, its entry has the manifest's form with `id`, `name` and `bounds` equal to the list's and a
`coverage`, and its files are exactly the listed cells' files, as regular files under its folder, each
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

- **WHEN** a region's entry lists cell `158_-425` and its artifact has no file for it
- **THEN** the deploy job fails naming the region, and `data` is not pushed

#### Scenario: An artifact without coverage

- **WHEN** a region's entry has no `coverage`, or a `coverage` holding `../x` or the same id twice
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
an array of cell ids, a listed file the tree doesn't hold, or a symbolic link anywhere in the tree
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

- **WHEN** the previous manifest's `colorado` entry has `coverage` `"all"`, or a `coverage` holding `../x`
- **THEN** the deploy job fails saying so, and `data` is not pushed

### Requirement: Each region job reports its size

Each region's job SHALL report, in its log and job summary, its matching node and way counts, total
bytes written, its largest 0.25° cell before splitting (id and bytes), its cell, split-cell, file and
coverage-cell counts.

#### Scenario: The Colorado report

- **WHEN** the `colorado` job finishes building
- **THEN** its job summary shows those numbers for `colorado`
