---
status: accepted
date: 2026-11-07
decision-makers: the owner (static Pages, no Cloudflare credential, R2 rejected); Claude (the orphan-branch mechanics)
---
# The extract is a static Cloudflare Pages site built from an orphan `data` branch, with no Cloudflare credential in GitHub

## Context and Problem Statement

The extract needs a host the app can read cross-origin, at no cost whatever the traffic, and the
workflow should hold no credential beyond its own repository token.

## Considered Options

- A separate static Pages project, connected by Git to this repository's `data` branch (garmin-map ADRs 0231, 0232)
- Cloudflare R2 (garmin-map ADR 0228), rejected for having no spending cap
- `wrangler pages deploy` with a Pages token stored as a secret

## Decision Outcome

Chosen option: "static Pages from an orphan `data` branch", the owner's choice, because static asset
requests are never billed, and GitHub then holds no Cloudflare credential at all. Each run that
changes something replaces `data` with one parentless commit, so the branch carries no history.
Unchanged files keep their blobs.

### Consequences

- Good, because the only credential anywhere is the deploy job's own `GITHUB_TOKEN`.
- Bad, because a Pages build times out after 20 minutes. If the first upload can't finish in time,
  the token-based fallback needs its own ADR and the owner's decision first.
- Bad, because the deploy job's token can write the whole repository. ADR 0007 limits where it goes.
