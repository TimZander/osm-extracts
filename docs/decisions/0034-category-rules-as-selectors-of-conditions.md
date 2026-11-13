---
status: accepted
date: 2026-11-13
decision-makers: the change's author (change osm-volcanoes-forest-roads, design decisions 1 and 3); not an owner question
---
# The category rules are selectors of AND-ed conditions, and osmium pre-filters on each selector's first condition

## Context and Problem Statement

Until now each rule was one key and the values it may take, and any one rule was enough. The
`forest_roads` category needs two conditions together (a `highway` value and a forest-road mark in
`name`, `ref` or `operator`), and the mark is a word match that `osmium tags-filter` can't express.
The rules are copied by hand from garmin-map (ADR 0003), which keeps them as selectors of conditions.

## Considered Options

- Rules as selectors (any one enough) of conditions (all must hold), each `equals`, `anyOf` or
  `words`, in garmin-map's shape; osmium keeps whatever matches each selector's first condition
- Keep `{ k, values }` rules and add a special case for forest roads in the matcher
- The same selectors, with osmium also matching the marks (`w/name=*FSR*` and the like)

## Decision Outcome

Chosen option: the first, because the copy from garmin-map stays a transcription (the
`forest_roads` selectors here are the same three that garmin-map writes), and Node stays the only
place the rules are read. A special case would hide a category's rule in code that the next copy
would have to know about. osmium substring patterns are a second, looser reading of the marks
(`*FS*` would keep `FSA` and `OFFSET`), so they narrow less safely than they seem and could drift
from the Node matcher.

The pre-filter writes one expression per selector, from its first condition, and each expression
once; a selector whose first condition is `words` makes the build throw rather than silently
dropping its category from the filter. Word matching lowercases ASCII letters only, as garmin-map's
reference matcher does.

### Consequences

- Good, because the next change to the rules is copied as written, and the end-to-end test runs the
  real osmium filter.
- Bad, because every `highway=service|unclassified|track` way, and its nodes, now reaches
  `add-locations-to-ways` and the OPL reader, most of them to be dropped, so the build's
  intermediate files and time grow. The run after merge measures by how much.
