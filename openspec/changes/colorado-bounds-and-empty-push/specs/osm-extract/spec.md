## ADDED Requirements

### Requirement: The bounds guard names the first failing point

When a region's `bounds` fail the polygon check, the job's error SHALL name the region and the first
failing point, checked in this order: the corners south-west, south-east, north-east and north-west,
each outside the polygon or on a ring; then a ring vertex inside the rectangle; then a ring edge
touching or crossing the rectangle's edges, by its two ends. Every point SHALL be written
`(lat, lon)`.

#### Scenario: A corner outside

- **WHEN** region `sample`'s `bounds` are south 39, west -108, north 40, east -105, and its polygon's west edge is at -107.5
- **THEN** the job fails with a message naming `sample` and its south-west corner `(39, -108)` as outside the polygon

#### Scenario: A ring vertex inside

- **WHEN** every corner of region `sample`'s `bounds` is inside its polygon, and a notch puts a ring vertex at latitude 39.5, longitude -105.5 inside the bounds
- **THEN** the job fails with a message naming `sample` and the ring vertex `(39.5, -105.5)`

#### Scenario: A ring edge crossing

- **WHEN** every corner is inside, no ring vertex is inside, and a ring edge from `(38, -106)` to `(41, -106.2)` crosses the bounds
- **THEN** the job fails with a message naming `sample` and the edge from `(38, -106)` to `(41, -106.2)`

## MODIFIED Requirements

### Requirement: Publishing replaces the site with one orphan commit

The deploy job SHALL commit the assembled tree as one commit with no parent and force-push it to
`data`, but only when its manifest lists at least one region (checked first, so an empty site never
replaces what is there) and the tree differs from the previous `data` tree. A site with no valid
manifest SHALL fail the job unpushed. Runs SHALL share one concurrency group without cancelling a run
in progress, so two runs never publish at once.

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

- **WHEN** the assembled site's `manifest.json` is missing or isn't valid JSON
- **THEN** the deploy job fails, and nothing is pushed

#### Scenario: The push fails

- **WHEN** the push is rejected
- **THEN** the job fails, and the previous site and every file its manifest lists stay as they were
