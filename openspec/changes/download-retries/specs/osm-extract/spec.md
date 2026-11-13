## ADDED Requirements

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
- **THEN** it is requested 3 times, with waits of 30 seconds and then 2 minutes between, and the region's job fails with nothing of that region changed

#### Scenario: Too many requests

- **WHEN** the polygon's first request answers HTTP 429 and its second succeeds
- **THEN** the region builds from the second download

#### Scenario: A body cut off, then whole

- **WHEN** the polygon's first response body fails before the end with an underlying error of code `ECONNRESET`, and its second arrives whole
- **THEN** the region builds from the whole polygon of the second download

#### Scenario: A missing file is not retried

- **WHEN** the `.md5` download answers 404
- **THEN** it is requested once, with no wait, and the region's job fails

#### Scenario: A corrupt download is not retried

- **WHEN** the PBF downloads whole and its MD5 differs from the `.md5`
- **THEN** nothing is downloaded again, and the region's job fails

### Requirement: Network-level download failures

A download attempt SHALL count as failing at the network level when its answer is HTTP 5xx or 429, or
when its request or its body fails with an underlying error whose code is `ECONNREFUSED`,
`ECONNRESET`, `EPIPE` or `UND_ERR_SOCKET` (a refused or reset connection), or `ETIMEDOUT`,
`UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT` or `UND_ERR_BODY_TIMEOUT` (a timeout). No other
failure SHALL count.

#### Scenario: A body that stops sending

- **WHEN** the PBF's first response body fails with an underlying error of code `UND_ERR_BODY_TIMEOUT`, and its second arrives whole
- **THEN** the region builds from the second download

#### Scenario: An unknown host

- **WHEN** the PBF's request fails with no response, with an underlying error of code `ENOTFOUND`
- **THEN** it is requested once, with no wait, and the region's job fails

#### Scenario: A TLS error

- **WHEN** the PBF's request fails with no response, with an underlying error of code `CERT_HAS_EXPIRED`
- **THEN** it is requested once, with no wait, and the region's job fails

#### Scenario: An underlying error with no code

- **WHEN** the PBF's request fails with no response, with an underlying error that has no code
- **THEN** it is requested once, with no wait, and the region's job fails

### Requirement: Each failed download attempt is logged on one line

Each failed download attempt SHALL be logged on one line naming the file's URL, the attempt's number
out of 3, and its cause (its HTTP status, or its underlying error's code and message), followed by the
wait before the next attempt, or by "giving up" when no attempt follows. Control characters in the
cause SHALL NOT start a new line.

#### Scenario: A retried attempt

- **WHEN** the PBF's first attempt fails with an underlying error of code `ECONNREFUSED` and message `connect ECONNREFUSED`
- **THEN** one log line names the PBF's URL, attempt 1 of 3, `ECONNREFUSED: connect ECONNREFUSED` and a wait of 30 seconds

#### Scenario: The last attempt

- **WHEN** the `.md5`'s third attempt answers HTTP 503
- **THEN** one log line names the `.md5`'s URL, attempt 3 of 3, HTTP 503 and "giving up"

#### Scenario: A 404 is the last attempt

- **WHEN** the `.md5`'s first attempt answers 404
- **THEN** one log line names the `.md5`'s URL, attempt 1 of 3, HTTP 404 and "giving up"

#### Scenario: A hostile cause

- **WHEN** an attempt fails with an underlying error whose code and message hold carriage returns, line feeds and `::warning::`
- **THEN** the log line for it is one line, and no line of the log starts with `::`

## MODIFIED Requirements

### Requirement: A failed or corrupt download publishes nothing new for the region

A region's job SHALL fail, and nothing of that region SHALL change, when the download of its PBF, its
`.md5` or its polygon fails on its last attempt, or the PBF's MD5 differs from the `.md5`. A failed
download's error SHALL name its URL and, when the last attempt's failure has an underlying error
(before any response or while the body streams), that error's message, after its code when it has one.

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
