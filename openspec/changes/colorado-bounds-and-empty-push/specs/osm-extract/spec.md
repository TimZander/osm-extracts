## MODIFIED Requirements

### Requirement: A region's bounds lie inside its Geofabrik polygon

A region's `bounds` SHALL lie wholly inside its Geofabrik extract polygon (`<path>.poly`, every ring,
holes included), so every area inside `bounds` has data: each corner inside the polygon, no ring edge
touching or crossing the rectangle's edges, and no ring vertex inside it. A point on a ring counts as
outside. Otherwise the region's job SHALL fail before its files are built, naming the region and the
first failing point: a corner outside, a ring vertex inside, or a ring edge's two ends.

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

#### Scenario: The failing corner is named

- **WHEN** region `sample`'s `bounds` are south 39, west -108, north 40, east -105, and its polygon's west edge is at -107.5
- **THEN** the job fails with a message naming `sample` and its south-west corner `(39, -108)` as outside the polygon

#### Scenario: The failing ring point is named

- **WHEN** a polygon's notch has a vertex at latitude 39.5, longitude -105.5 inside the region's `bounds`
- **THEN** the job fails with a message naming that edge or vertex, with its coordinates

### Requirement: Publishing replaces the site with one orphan commit

The deploy job SHALL commit the assembled tree as one commit with no parent and force-push it to
`data`, but only when that tree differs from the previous `data` tree and its manifest lists at least
one region, so an empty site never replaces what is there. Runs SHALL share one concurrency group
without cancelling a run in progress, so two runs never publish at once.

#### Scenario: A changed tree

- **WHEN** the assembled tree differs from the previous `data` tree, and its manifest lists a region
- **THEN** `data` becomes one commit with no parent whose tree is the assembled tree

#### Scenario: Nothing changed

- **WHEN** the assembled tree equals the previous `data` tree
- **THEN** nothing is pushed, and the log says so

#### Scenario: No region at all

- **WHEN** every region job fails and the previous site lists no region, so the new manifest lists none
- **THEN** nothing is pushed, the log says the manifest lists no region, and `data` stays as it was

#### Scenario: The push fails

- **WHEN** the push is rejected
- **THEN** the job fails, and the previous site and every file its manifest lists stay as they were
