# Proposal: osm-volcanoes-forest-roads

## Why

garmin-map changed its category rules (commit `755fe009346756284afcb7c187e9465236c7de0d`): volcanoes
now count as peaks, and forest roads get a category of their own. The extract holds only what those
rules select, and the rules here must be a copy of garmin-map's ("The category rules name the
garmin-map commit they were copied from"), so the pipeline follows. Until it does, an app built on the
new rules finds no volcanoes and no forest roads in the extract. The app ignores category ids it
doesn't know, so data built on either side of this change is safe for it.

## What Changes

- **`peaks`** also takes nodes tagged `natural=volcano`.
- **`forest_roads`**, a new way category placed just before `trails`: a way whose `highway` is
  `service`, `unclassified` or `track` and whose `name`, `ref` or `operator` carries a forest-road
  mark (for example `name=Example Creek FSR`, `ref=FS 400`, `operator=US Forest Service`). A track
  that is a forest road stays in `trails` too, so its `_osmCategories` is
  `["forest_roads", "trails"]`.
- **A word match.** The marks are matched as whole words, case-insensitively: `FS 400` and `NF-123`
  carry the marks `FS` and `NF`, `FS400` doesn't, and `Forestview Service Road` doesn't carry
  `Forest Service Road`.
- **Rules with several conditions.** Until now each rule was one key and its allowed values. A rule
  becomes a list of conditions, all of which must hold, in the shape garmin-map keeps them in, so
  the copy stays mechanical.
- **`categoriesFrom`** moves to `755fe009346756284afcb7c187e9465236c7de0d`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `osm-extract`: "The import's categories" adds `natural=volcano` to `peaks` and `forest_roads`
  before `trails`. Two new requirements say which ways are forest roads and how a tag value carries
  a phrase as words.

## Impact

- `src/categories.mjs` (the rules, the matcher, the osmium pre-filter), `test/features.test.mjs`,
  the end-to-end fixture `test/fixtures/sample.osm` and `test/build-region-e2e.test.mjs`.
- The osmium pre-filter keeps every `highway=service|unclassified|track` way for Node to decide, so
  the intermediate files of each region grow (design decision 3).
- The published files grow by the forest roads and volcanoes found. The manual run after merge
  publishes them for every region; a region whose files break the 20 MiB guard fails alone
  (design, risks).
- The workflow file is not touched.
