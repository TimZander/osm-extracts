## ADDED Requirements

### Requirement: The region builder has a 12 GiB heap

The region job SHALL run `src/build-region.mjs` with Node's old-space heap limit set to 12,288 MiB
(`--max-old-space-size=12288`), so a region whose build needs more than Node's default heap can still
build on the runner's 16 GB.

#### Scenario: The build step

- **WHEN** the extract workflow's region job builds a region
- **THEN** its build step runs `node --max-old-space-size=12288 src/build-region.mjs` for that region

## MODIFIED Requirements

### Requirement: A failed or corrupt download publishes nothing new for the region

A region's job SHALL fail, and nothing of that region SHALL change, when the download of its PBF, its
`.md5` or its polygon fails, or the PBF's MD5 differs from the `.md5`. A failed download's error SHALL
name its URL and, when the failure has an underlying error (before any response or while the body
streams), that error's message, after its code when it has one.

#### Scenario: The checksum can't be fetched

- **WHEN** the `.md5` download answers 404
- **THEN** the region's job fails, and nothing of that region changes

#### Scenario: An MD5 mismatch

- **WHEN** the downloaded PBF's MD5 differs from Geofabrik's `.md5`
- **THEN** the region's job fails, none of its files change, and the manifest keeps its previous entry for it

#### Scenario: A request that fails before any response

- **WHEN** the PBF's request fails with no response, and the underlying error has code `ECONNRESET` and message `read ECONNRESET`
- **THEN** the region's job fails with an error naming the PBF's URL, `ECONNRESET` and `read ECONNRESET`, and nothing of that region changes

#### Scenario: A download cut off mid-stream

- **WHEN** the polygon's response starts, and its body fails before the end with an underlying error of code `ECONNRESET` and message `read ECONNRESET`
- **THEN** the region's job fails with an error naming the polygon's URL, `ECONNRESET` and `read ECONNRESET`, and nothing of that region changes
