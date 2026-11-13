## MODIFIED Requirements

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
