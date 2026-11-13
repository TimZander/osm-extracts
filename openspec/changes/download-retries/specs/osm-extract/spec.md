## ADDED Requirements

### Requirement: A download is retried after a network failure

A download of a region's PBF, `.md5` or polygon that fails at the network level (a refused or reset
connection, a timeout, or an HTTP 5xx or 429 answer, before or during the body) SHALL be tried again
from its start, up to 2 times, after a wait of 30 seconds and then of 2 minutes. Any other failure
SHALL end it at once. Each failed attempt SHALL be logged with its URL, its cause and its attempt
number.

#### Scenario: A refused connection, then a good download

- **WHEN** the PBF's first request fails with no response, with an underlying error of code `ECONNREFUSED`, and its second succeeds
- **THEN** the region builds from the second download, after a wait of 30 seconds, and the log names the PBF's URL, `ECONNREFUSED` and attempt 1 of 3

#### Scenario: A server error on every attempt

- **WHEN** every request for the `.md5` answers HTTP 503
- **THEN** it is requested 3 times, with waits of 30 seconds and then 2 minutes between, the log names attempts 1, 2 and 3 of 3, and the region's job fails with nothing of that region changed

#### Scenario: Too many requests

- **WHEN** the polygon's first request answers HTTP 429 and its second succeeds
- **THEN** the region builds from the second download

#### Scenario: A body cut off, then whole

- **WHEN** the polygon's first response body fails before the end with an underlying error of code `ECONNRESET`, and its second arrives whole
- **THEN** the region builds from the whole polygon of the second download

#### Scenario: A missing file is not retried

- **WHEN** the `.md5` download answers 404
- **THEN** it is requested once, with no wait, and the region's job fails

#### Scenario: An error that isn't the network's is not retried

- **WHEN** the PBF's request fails with no response, with an underlying error of code `CERT_HAS_EXPIRED`
- **THEN** it is requested once, with no wait, and the region's job fails

#### Scenario: A corrupt download is not retried

- **WHEN** the PBF downloads whole and its MD5 differs from the `.md5`
- **THEN** nothing is downloaded again, and the region's job fails

## MODIFIED Requirements

### Requirement: A failed or corrupt download publishes nothing new for the region

A region's job SHALL fail, and nothing of that region SHALL change, when the download of its PBF, its
`.md5` or its polygon fails after its last attempt, or the PBF's MD5 differs from the `.md5`. A failed
download's error SHALL name its URL and, when the failure has an underlying error (before any response
or while the body streams), that error's message, after its code when it has one.

#### Scenario: The checksum can't be fetched

- **WHEN** the `.md5` download answers 404
- **THEN** the region's job fails, and nothing of that region changes

#### Scenario: An MD5 mismatch

- **WHEN** the downloaded PBF's MD5 differs from Geofabrik's `.md5`
- **THEN** the region's job fails, none of its files change, and the manifest keeps its previous entry for it

#### Scenario: A request that fails before any response

- **WHEN** every attempt at the PBF's request fails with no response, and the underlying error has code `ECONNRESET` and message `read ECONNRESET`
- **THEN** the region's job fails with an error naming the PBF's URL, `ECONNRESET` and `read ECONNRESET`, and nothing of that region changes

#### Scenario: A download cut off mid-stream

- **WHEN** on every attempt the polygon's response starts, and its body fails before the end with an underlying error of code `ECONNRESET` and message `read ECONNRESET`
- **THEN** the region's job fails with an error naming the polygon's URL, `ECONNRESET` and `read ECONNRESET`, and nothing of that region changes
