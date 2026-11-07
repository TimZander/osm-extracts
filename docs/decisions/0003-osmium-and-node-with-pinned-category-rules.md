---
status: proposed
date: 2026-11-07
decision-makers: Claude (carried over from garmin-map ADR 0223, with the geometry change below); the owner accepts it with the PR
---
# osmium narrows the data, Node builds the features; the category rules are copied from garmin-map at a pinned commit

## Context and Problem Statement

The extract must hold exactly what the import's categories select, with closed ways kept as lines.
The rules live in garmin-map's code, and the two copies must not drift apart silently.

## Considered Options

- `osmium tags-filter`, then `osmium export` to GeoJSON, then Node
- `osmium tags-filter`, then `osmium add-locations-to-ways` to OPL, then Node builds the geometry
- ogr2ogr, osm2pgsql, pyosmium

## Decision Outcome

Chosen option: "tags-filter, add-locations-to-ways to OPL, Node", because osmium-tool is in Ubuntu's
archive and fast, and the Node classifier decides every feature from one copy of the rules. Tried
locally on osmium 1.16.0 (the version Ubuntu 24.04 ships): `osmium export` writes a closed way tagged
`area=yes` as a MultiPolygon whatever its config, which would lose closed footways. Reading OPL
avoids every such heuristic. garmin-map ADR 0223 chose osmium plus Node; this repository changes only
how the geometry is read.

The rules are copied from garmin-map commit `1a498d2fe984186328b2a9e6fc7e1ad232329952`, which the
manifest names in `categoriesFrom`.

### Consequences

- Good, because a node osmium keeps only as a way vertex (a gate, say) is dropped unless it matches a
  category itself.
- Bad, because a change to the categories is a change in both repositories, and the commit pin is
  updated by hand.
