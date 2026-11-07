## ADDED Requirements

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

## MODIFIED Requirements

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
