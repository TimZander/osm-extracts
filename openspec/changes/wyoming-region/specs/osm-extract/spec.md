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
