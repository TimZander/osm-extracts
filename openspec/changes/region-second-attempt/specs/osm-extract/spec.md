## ADDED Requirements

### Requirement: A failed region is built once more on a fresh runner

When any region's job fails, a second-attempt job SHALL run for every listed region once all region
jobs end, unless the run was cancelled. For a region whose artifact already exists it SHALL stop
without building; otherwise it SHALL build the region on its own runner exactly as the region job
does, ending with the same artifact. When every region's job succeeds, no second-attempt job SHALL run.

#### Scenario: One region refused on its first runner

- **WHEN** `colorado`'s region job fails after its downloads were refused, and `idaho`'s succeeds
- **THEN** a second-attempt job builds `colorado` on another runner and uploads `region-colorado`, and the one for `idaho` builds nothing

#### Scenario: Every region succeeds

- **WHEN** every region's job uploads its artifact
- **THEN** no second-attempt job runs, and the deploy job runs as before

#### Scenario: Both attempts fail

- **WHEN** `colorado`'s region job and its second-attempt job both fail
- **THEN** there is no `region-colorado` artifact, and the deploy job keeps `colorado`'s previous files

## MODIFIED Requirements

### Requirement: A region job hands its tree to the deploy job and writes nothing

Each region's job SHALL build its tree and manifest entry and, as its last step, hand them to the
deploy job as an Actions artifact named for the region, kept for one day; a region counts as
succeeded exactly when its artifact exists, from either attempt. No region job or second-attempt job
SHALL write the repository. The deploy job SHALL run after every region job and second-attempt job
ends, unless the run was cancelled or the regions list failed.

#### Scenario: Two regions

- **WHEN** two regions build in parallel
- **THEN** the manifest lists both, written once, by the deploy job

#### Scenario: A bad regions list

- **WHEN** the regions list fails its checks
- **THEN** no region job and no deploy job runs

#### Scenario: A cancelled run

- **WHEN** the owner cancels a run while a region job is building
- **THEN** the deploy job doesn't run, and `data` doesn't change

#### Scenario: A region built on its second attempt

- **WHEN** `colorado`'s region job fails and its second-attempt job uploads `region-colorado`
- **THEN** the deploy job publishes this run's `colorado`

### Requirement: A failed region keeps its previous files

When a region fails both attempts, the other region jobs SHALL run to the end, the deploy job SHALL still
publish the regions that succeeded, and it SHALL keep the failed region's previous manifest entry and
every file it lists from the previous `data` tree, the entry's `coverage` (or lack of one) included.
A failed region that was never published, and a region no longer in the regions list, SHALL be left
out of the manifest.

#### Scenario: One region fails

- **WHEN** `colorado` published last week and both its attempts fail this week
- **THEN** the new manifest holds last week's `colorado` entry, and every file it lists is in the new tree

#### Scenario: A region taken off the list

- **WHEN** `utah` was in last run's manifest and is no longer in the regions list
- **THEN** the new manifest has no `utah` entry, and this run's tree still holds the files last run's manifest listed for it

#### Scenario: A kept entry and its coverage

- **WHEN** both of `colorado`'s attempts fail, and last week's `colorado` entry has a `coverage`, or has none because it was built before `coverage` existed
- **THEN** the new manifest's `colorado` entry has the same `coverage` ids, sorted, or none

### Requirement: Every job has a time limit

The plan job SHALL be stopped after 5 minutes, a region job and a second-attempt job after 120
minutes each, and the deploy job after 30 minutes. A region job stopped this way SHALL count as a
failed first attempt, and a second-attempt job stopped this way as a failed second attempt.

#### Scenario: A region job that runs too long

- **WHEN** a region job is still building after 120 minutes
- **THEN** it is stopped, it uploads no artifact, and the region gets its second attempt

#### Scenario: A second attempt that runs too long

- **WHEN** a second-attempt job is still building after 120 minutes
- **THEN** it is stopped, it uploads no artifact, and the deploy job keeps that region's previous files

### Requirement: Only the deploy job can write the repository

The workflow's top-level `permissions` SHALL be `contents: read` alone. Region jobs and second-attempt
jobs SHALL have `contents: read` alone and check out with `persist-credentials: false`. Only the
deploy job SHALL have `contents: write`; its token SHALL be passed to no step but its checkout and its
push, and SHALL not be stored in the git config.

#### Scenario: Reading the permissions

- **WHEN** the workflow file is read
- **THEN** only the deploy job has `contents: write`, and no job has any other write permission

#### Scenario: Where the token goes

- **WHEN** the workflow file is read
- **THEN** `github.token` appears only in the `env` of the deploy job's push step, and every checkout sets `persist-credentials: false`

#### Scenario: A compromised region job

- **WHEN** code in a region job or a second-attempt job tries to push
- **THEN** it holds no credential that can push
