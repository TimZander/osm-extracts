# Design: osm-volcanoes-forest-roads

## Context

See proposal.md. The rules are copied from garmin-map's `OSM_CATEGORIES` at
`755fe009346756284afcb7c187e9465236c7de0d`. That commit also carries garmin-map's reading of the
rules (how a selector, a condition and a word match are met); this change implements the same
reading in `src/categories.mjs`. `download.geofabrik.de` is not reachable from the agent container,
so nothing here was measured on real data; the tests use hand-written fixtures.

## Decisions

1. **The rules keep garmin-map's shape.** A category holds selectors (any one is enough); a
   selector holds an element type and conditions (all must hold); a condition is a key and one of
   `equals` (one value), `anyOf` (a list of values) or `words` (a list of phrases). Today's
   `{ k, values }` rules are each one selector with one `anyOf` condition, but copying the new
   rules by hand into the old shape would mean flattening `forest_roads` into something garmin-map
   doesn't write. Keeping the shape makes the next copy a straight transcription (ADR 0034).
2. **A word match lowercases ASCII letters only**, as garmin-map's reference matcher at that commit
   does (it replaces `A`–`Z` and nothing else), so this is the copied reading, not a new choice. `A`–`Z` become `a`–`z`; every other character
   is left alone, then is a word break because it isn't `a`–`z` or `0`–`9`. JavaScript's
   `toLowerCase` would turn some non-ASCII letters into ASCII ones (the Kelvin sign `K`, U+212A,
   becomes `k`; `İ`, U+0130, becomes `i` and a combining dot), so a value could carry a mark it
   doesn't show. The phrase's words must be next to each other: `Forest Service Access Road` doesn't
   carry `Forest Service Road`. A phrase with no words carries nothing; no rule has one, so the
   extract can't show it and it is tested on the matcher alone.
3. **The osmium pre-filter takes one condition per selector.** `osmium tags-filter` keeps an
   element when any one expression matches; it can't AND two conditions or match words. Each
   selector contributes the expression for its first condition, which must be `equals` or `anyOf`
   (a selector whose first condition is `words` makes the build throw, naming the category, rather
   than dropping it from the pre-filter); repeated expressions are written once. garmin-map lists
   `highway` first in each forest-road selector. The three `forest_roads` selectors all give
   `w/highway=service,unclassified,track`; `categoriesFor` decides. The cost: every service,
   unclassified and track way, and its nodes, goes through `add-locations-to-ways` and the OPL
   reader, most of them to be dropped. Tracks were already kept for `trails`. A word expression in
   osmium (`w/name=*FSR*`) would be a second, looser reading of the marks, and two readings can
   drift; Node stays the one place the rules are read (ADR 0003).
4. **Tests use the spec's scenarios as illustrative data**, plus the cases listed in tasks 1.1 and
   1.2, and the existing cases unchanged.

## Risks

- **File sizes.** Colorado's largest file is 14,873,616 bytes against the 20 MiB guard (run 8).
  Forest roads in cities are rare (a street called "Forest Road" carries no mark), and the largest
  files are city quarters, so the assumption is that every region stays under the guard. If one
  doesn't, its job fails alone, naming the file ("No published file is over 20 MiB"), and the other
  regions still publish; the run's report says so.
- **Build time and memory.** The intermediate OPL grows by every unmarked service and unclassified
  way. British Columbia's build took 6 min 46 s, most of it the download; the run after merge
  measures the new figure.

## Open questions

None. The categories and their marks are garmin-map's (the owner's decisions there); the
reading of them (decision 2) is garmin-map's too. What this change decides itself, the shape the
rules are kept in and the pre-filter, is ADR 0034.
