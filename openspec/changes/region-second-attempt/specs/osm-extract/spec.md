## ADDED Requirements

### Requirement: A failed region is built once more on a fresh runner

When any region job doesn't succeed, a second-attempt job SHALL run for every listed region once all
region jobs end, unless the run was cancelled or the regions list failed. Where it finds the region's artifact it SHALL build
nothing; otherwise it SHALL build the region on its own runner as the region job does, ending with the
same artifact. A second-attempt job that builds SHALL meet every rule for a region's job. When every region job succeeds, no second-attempt job SHALL run.

#### Scenario: One region refused on its first runner

- **WHEN** `colorado`'s region job fails after its downloads were refused, and `idaho`'s succeeds
- **THEN** a second-attempt job builds `colorado` on another runner and uploads `region-colorado`, and the one for `idaho` builds nothing

#### Scenario: Every region succeeds

- **WHEN** every region's job uploads its artifact
- **THEN** no second-attempt job runs, and the deploy job runs as before

#### Scenario: Both attempts fail

- **WHEN** `colorado`'s region job and its second-attempt job both fail
- **THEN** there is no `region-colorado` artifact, and the deploy job keeps `colorado`'s previous files

#### Scenario: The same build

- **WHEN** the workflow file is read
- **THEN** the second-attempt job's steps after its artifact check, their conditions set aside, equal the region job's steps

#### Scenario: A region job stopped by its time limit

- **WHEN** `colorado`'s region job is stopped after 120 minutes, and the run wasn't cancelled
- **THEN** a second-attempt job builds `colorado`

## MODIFIED Requirements

### Requirement: A region job hands its tree to the deploy job and writes nothing

Each region job, and each second-attempt job that builds, SHALL build its tree and manifest entry and, as its last step, hand them to the
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

When a region job or second-attempt job fails, the others SHALL run to the end; when a region fails
both attempts, the deploy job SHALL still publish the regions that succeeded, and it SHALL keep the failed region's previous manifest entry and
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

### Requirement: The data date is the source's replication time

A region's `dataDate` SHALL be the UTC date of its source PBF header's `osmosis_replication_timestamp`.
A PBF without that timestamp SHALL fail the region's job.

#### Scenario: A dated file

- **WHEN** the PBF header's replication timestamp is `2026-10-28T20:21:02Z`
- **THEN** the region's `dataDate` is `2026-10-28`

#### Scenario: An undated file

- **WHEN** the PBF header has no replication timestamp
- **THEN** the region's job fails and hands over no artifact for the region

### Requirement: A region's bounds lie inside its Geofabrik polygon

A region's `bounds` SHALL lie wholly inside its Geofabrik extract polygon (`<path>.poly`, every ring,
holes included), so every area inside `bounds` has data: each corner inside the polygon, no ring edge
touching or crossing the rectangle's edges, and no ring vertex inside it. A point on a ring counts as
outside. Otherwise the region's job SHALL fail before its files are built, naming the region.

#### Scenario: Bounds reaching outside

- **WHEN** a region's `bounds` has a corner outside its Geofabrik polygon
- **THEN** the region's job fails naming the region, and hands over no artifact for the region

#### Scenario: Bounds inside

- **WHEN** a region's `bounds` lie inside its polygon, clear of every ring
- **THEN** the region builds

#### Scenario: A notch in the polygon

- **WHEN** every corner of a region's `bounds` is inside its polygon, but the polygon has a notch that cuts into the rectangle
- **THEN** the region's job fails naming the region

#### Scenario: A hole in the polygon

- **WHEN** the polygon has a hole that lies inside the region's `bounds`
- **THEN** the region's job fails naming the region

### Requirement: A failed or corrupt download publishes nothing new for the region

A region's job SHALL fail, handing over no artifact for the region, when the download of its PBF, its
`.md5` or its polygon fails on its last attempt, or the PBF's MD5 differs from the `.md5`. A failed
download's error SHALL name its URL and, when the last attempt's failure has an underlying error
(before any response or while the body streams), that error's message, after its code when it has one.

#### Scenario: The checksum can't be fetched

- **WHEN** the `.md5` download answers 404
- **THEN** the region's job fails and hands over no artifact for the region

#### Scenario: An MD5 mismatch

- **WHEN** the downloaded PBF's MD5 differs from Geofabrik's `.md5`
- **THEN** the region's job fails and hands over no artifact for the region

#### Scenario: A request that fails before any response

- **WHEN** every attempt at the PBF's request fails with no response, and the underlying error has code `ECONNRESET` and message `read ECONNRESET`
- **THEN** the region's job fails with an error naming the PBF's URL, `ECONNRESET` and `read ECONNRESET`, and hands over no artifact for the region

#### Scenario: A download cut off mid-stream

- **WHEN** on every attempt the polygon's response starts, and its body fails before the end with an underlying error of code `ECONNRESET` and message `read ECONNRESET`
- **THEN** the region's job fails with an error naming the polygon's URL, `ECONNRESET` and `read ECONNRESET`, and hands over no artifact for the region

### Requirement: No published file is over 20 MiB

A region whose files include one larger than 20 MiB (20,971,520 bytes) SHALL fail its job, naming the
file and its size, and hand over no artifact for the region.

#### Scenario: A 21 MiB quarter

- **WHEN** a region writes a 21 MiB file
- **THEN** its job fails naming the file and its size, and hands over no artifact for the region

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

- **WHEN** every region fails both attempts and the previous site lists no region, so the new manifest lists none (whether or not the tree changed)
- **THEN** nothing is pushed, the log says the manifest lists no region, the deploy job succeeds, and `data` stays as it was

#### Scenario: No valid manifest

- **WHEN** the assembled site's `manifest.json` is missing, isn't valid JSON, or is `{}`
- **THEN** the deploy job fails, and nothing is pushed

#### Scenario: The push fails

- **WHEN** the push is rejected
- **THEN** the job fails, and the previous site and every file its manifest lists stay as they were

### Requirement: Each region job reports its size

Each region job, and each second-attempt job that builds, SHALL report, in its log and job summary, its matching node and way counts, total
bytes written, its largest 0.25° cell before splitting (id and bytes), its cell, split-cell, file and
coverage-cell counts.

#### Scenario: The Colorado report

- **WHEN** the `colorado` job finishes building
- **THEN** its job summary shows those numbers for `colorado`

### Requirement: The region builder has a 12 GiB heap

The region job and the second-attempt job SHALL run `src/build-region.mjs` with Node's old-space heap limit set to 12,288 MiB
(`--max-old-space-size=12288`), so a region whose build needs more than Node's default heap can still
build on the runner's 16 GB.

#### Scenario: The build step

- **WHEN** the extract workflow's region job builds a region
- **THEN** its build step runs `node --max-old-space-size=12288 src/build-region.mjs` for that region

### Requirement: A download is retried after a network failure

A download of a region's PBF, `.md5` or polygon whose attempt fails at the network level (see
"Network-level download failures") SHALL be tried again from the start of the file, up to 2 times,
after a wait of 30 seconds before the second attempt and of 2 minutes before the third. Any other
failure SHALL end the download at once, with no further attempt. Each of the three files SHALL have
its own attempts.

#### Scenario: A refused connection, then a good download

- **WHEN** the PBF's first request fails with no response, with an underlying error of code `ECONNREFUSED`, and its second succeeds
- **THEN** the region builds from the second download, after a wait of 30 seconds

#### Scenario: A server error on every attempt

- **WHEN** every request for the `.md5` answers HTTP 503
- **THEN** it is requested 3 times, with waits of 30 seconds and then 2 minutes between, and the region's job fails and hands over no artifact for the region

#### Scenario: Too many requests

- **WHEN** the polygon's first request answers HTTP 429 and its second succeeds
- **THEN** the region builds from the second download

#### Scenario: A body cut off, then whole

- **WHEN** the polygon's first response body fails before the end with an underlying error of code `ECONNRESET`, and its second arrives whole
- **THEN** the region builds from the whole polygon of the second download

#### Scenario: Each file has its own attempts

- **WHEN** the PBF's first two requests answer HTTP 503 and its third succeeds, and the polygon's first two requests answer HTTP 503 and its third succeeds
- **THEN** the region builds, each of the two files having been requested 3 times

#### Scenario: A missing file is not retried

- **WHEN** the `.md5` download answers 404
- **THEN** it is requested once, with no wait, and the region's job fails

#### Scenario: A corrupt download is not retried

- **WHEN** the PBF downloads whole and its MD5 differs from the `.md5`
- **THEN** nothing is downloaded again, and the region's job fails
