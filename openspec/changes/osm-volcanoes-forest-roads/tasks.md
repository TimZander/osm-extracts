# Tasks

## 1. Tests first

- [ ] 1.1 Tests in `test/features.test.mjs`, citing "How a tag value has a phrase as words": on the matcher: `Elk Creek FSR` has `FSR`; `Forest-Service  Road 12` and `forest SERVICE road` have `Forest Service Road`; `FS 400` has `FS`; `NF-123` has `NF`; `FS400` hasn't `FS`; `Forestview Service Road`, `Road of the Forest Service` and `Forest Service Access Road` haven't `Forest Service Road`; the Kelvin sign then `FS 9` has `FS`, and a dotted capital I (U+0130) then `FS` has `FS` but not `IFS`; a phrase with no words (`""`, `--`) matches nothing; seen to fail
- [ ] 1.2 Tests citing "The import's categories" and "Which ways are forest roads": the catalog order with `forest_roads` before `trails`, `natural=volcano` in `peaks`, every scenario's tags, each of the three mark keys on each of `service`, `unclassified` and `track`, a marked `highway=residential` way and a marked `highway=path` way (`trails` only), a node tagged like a forest road (none); `CATEGORIES_FROM` is `755fe009346756284afcb7c187e9465236c7de0d`; seen to fail
- [ ] 1.3 Test of the osmium pre-filter: one expression per selector's first condition, repeats written once, so `w/highway=service,unclassified,track` appears once and `n/natural=volcano` is there (design decision 3); seen to fail
- [ ] 1.4 End-to-end fixture: a volcano, a marked service road, a marked track and an unmarked service road; `test/build-region-e2e.test.mjs` asserts the first three are in the extract with their categories and the last is not; seen to fail

## 2. Code

- [ ] 2.1 `src/categories.mjs`: the rules in garmin-map's shape (selectors of AND-ed `equals` / `anyOf` / `words` conditions), copied from `755fe00`, `CATEGORIES_FROM` moved to it, the word match (design decision 2), the pre-filter (design decision 3); verify `npm test`

## 3. Review

- [ ] 3.1 `/sdd:conformance-review osm-volcanoes-forest-roads`, findings routed with `/sdd:spec-fix`
- [ ] 3.2 Scan the diff for private material (this repository is public; only the copied rule data and generic mentions of garmin-map)

## 4. Decisions

- [ ] 4.1 ADR 0034 (rules as selectors of AND-ed conditions; one pre-filter expression per selector), with the index updated

## Workflow follow-up

- After the owner's "merge": archive this change in its own PR.
- Then one manual extract run on `main`, default inputs, once no other extract run is in progress (ADR 0027); report the volcanoes and forest roads found per region.
