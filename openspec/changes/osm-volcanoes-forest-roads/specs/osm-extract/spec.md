## MODIFIED Requirements

### Requirement: The import's categories

The categories, in catalog order, SHALL be: on nodes, `peaks` (`natural=peak|volcano`), `passes`
(`mountain_pass=yes` or `natural=saddle`), `huts` (`tourism=alpine_hut|wilderness_hut` or
`amenity=shelter`), `hot_springs` (`natural=hot_spring`), `trailheads` (`highway=trailhead`) and
`parking` (`amenity=parking`); on ways, `forest_roads` (forest roads, below), `trails`
(`highway=path|footway|track|bridleway`) and `ridges` (`natural=ridge`).

#### Scenario: A shelter

- **WHEN** a node is tagged `amenity=shelter`
- **THEN** its feature's `_osmCategories` is `["huts"]`

#### Scenario: A ridge that is also a track

- **WHEN** a way is tagged `highway=track` and `natural=ridge`
- **THEN** its feature's `_osmCategories` is `["trails", "ridges"]`

#### Scenario: A volcano

- **WHEN** a node is tagged `natural=volcano`
- **THEN** its feature's `_osmCategories` is `["peaks"]`

#### Scenario: A track that is a forest road

- **WHEN** a way is tagged `highway=track` and `ref=FS 123`
- **THEN** its feature's `_osmCategories` is `["forest_roads", "trails"]`

## ADDED Requirements

### Requirement: Which ways are forest roads

A way SHALL be in `forest_roads` exactly when both hold: its `highway` is `service`, `unclassified`
or `track`; and its `name` has as words one of `FSR`, `NFSR`, `Forest Service Road`,
`Forest Service Rd`, `National Forest Development Road`, `Resource Road`, `Resource Rd`, or its `ref`
one of `FS`, `FR`, `NF`, `NFSR`, `FSR`, `USFS`, or its `operator` one of `Forest Service`, `USFS`,
`Ministry of Forests`, `BC Timber Sales`.

#### Scenario: Marked by its name

- **WHEN** a way is tagged `highway=unclassified` and `name=Example Creek FSR`
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`

#### Scenario: Marked by its ref

- **WHEN** a way is tagged `highway=service` and `ref=FS 400`
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`

#### Scenario: Marked by its operator

- **WHEN** a way is tagged `highway=service` and `operator=US Forest Service`
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`

#### Scenario: An unmarked track

- **WHEN** a way is tagged `highway=track` and has no `name`, `ref` or `operator`
- **THEN** its feature's `_osmCategories` is `["trails"]`

#### Scenario: An unmarked gravel driveway

- **WHEN** a way is tagged `highway=service`, `service=driveway`, `surface=gravel` and `name=Example Ranch Road`
- **THEN** the extract holds no feature for it

#### Scenario: A street called Forest Road

- **WHEN** a way is tagged `highway=unclassified` and `name=Forest Road`
- **THEN** the extract holds no feature for it

#### Scenario: A marked residential street

- **WHEN** one way is tagged `highway=residential` and `name=Example FSR`, another `highway=residential` and `ref=FS 400`, and a third `highway=residential` and `operator=US Forest Service`
- **THEN** the extract holds no feature for any of them

### Requirement: How a tag value has a phrase as words

A tag value SHALL have a phrase as words when, with the ASCII letters of both lowercased and each
split into words at every character other than `a`–`z` and `0`–`9` (empty words dropped), the
phrase's words appear in the value's words in the same order and next to each other, with no other
word between them.

#### Scenario: Whole words, any case

- **WHEN** a way is tagged `highway=service` and `name=example FOREST-service  road 12`
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`

#### Scenario: Another word between the phrase's words

- **WHEN** a way is tagged `highway=service` and `name=Example Forest Service Access Road`
- **THEN** the extract holds no feature for it

#### Scenario: A mark joined to a number

- **WHEN** a way is tagged `highway=service` and `ref=NF-123`
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`

#### Scenario: A mark joined to a number by a non-ASCII dash

- **WHEN** a way is tagged `highway=service` and `ref=FS–400` (an en dash, U+2013)
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`

#### Scenario: A mark inside a longer word

- **WHEN** a way is tagged `highway=service` and `ref=FS400`
- **THEN** the extract holds no feature for it

#### Scenario: The words out of order or part of other words

- **WHEN** one way tagged `highway=service` has `name=Forestview Service Road` and another `name=Road of the Forest Service`
- **THEN** the extract holds no feature for either

#### Scenario: A letter that lowercases only outside ASCII

- **WHEN** a way is tagged `highway=service` and its `ref` is the Kelvin sign (U+212A, which full Unicode lowercasing turns into `k`) then, with no space, `FS 9`
- **THEN** its feature's `_osmCategories` is `["forest_roads"]`, because the Kelvin sign is a word break and `FS` a word of its own
