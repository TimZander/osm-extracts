---
status: accepted
date: 2026-11-07
decision-makers: Claude (carried over from garmin-map ADR 0234, with the rule split below); accepted by the owner on 2026-11-07 (weekly-extract open question 9)
---
# The site sets open-read CORS and its cache times in `_headers`, set per path so no header is doubled, and ships a `404.html`

## Context and Problem Statement

The app reads the site cross-origin from production, previews and `localhost`. Its staleness analysis
assumes the manifest is cached for 5 minutes and cells for an hour. Without a top-level `404.html`,
Pages answers a missing path with the root page and a `200`.

## Considered Options

- One `/*` rule with CORS and `Cache-Control`, plus a `/manifest.json` rule (garmin-map ADR 0234 as written)
- CORS on `/*`, and `Cache-Control` on rules that never overlap: `/:region/*`, `/LICENSE.txt`, `/manifest.json`
- Pages' defaults only

## Decision Outcome

Chosen option: "CORS on `/*`, Cache-Control per path", because Pages joins the values when two
matching rules set the same header, so the first option would give `/manifest.json` two
`Cache-Control` values. This option gives each path exactly the headers garmin-map ADR 0234 asks for.
The data is public ODbL data, read without credentials, so `Access-Control-Allow-Origin: *` exposes
nothing.

### Consequences

- Good, because a missing file is a real `404`, which the reader reports.
- Bad, because a new kind of top-level file needs its own `Cache-Control` rule.
