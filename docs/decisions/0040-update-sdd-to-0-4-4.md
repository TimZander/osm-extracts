---
status: accepted
date: 2026-11-25
decision-makers: the owner (asked for every sdd repository to be updated to the plugin's current version)
---
# Update sdd from 0.3.2 to 0.4.4

## Context and Problem Statement

This repository's sdd files were at 0.3.2; the plugin is at 0.4.4. An sdd archive verify before
0.4.3 fails an archive commit, so the next archive PR would fail. 0.4.4 brings spec review's
pass I questions.

## Considered Options

- Update to 0.4.4 now, in its own PR
- Stay on 0.3.2 and update at the next change

## Decision Outcome

Chosen option: "Update to 0.4.4 now", in a code-free PR, so the next archive doesn't fail and the
next spec review gets the new questions. `/sdd:init` updated `scripts/sdd/`, `.claude/sdd-workflow.md`
and `.claude/sdd-version`, and added an `engines` entry to `package-lock.json`.

The deletion check of `.claude/sdd-workflow.md` found only plugin text reworded (GitHub/Azure
DevOps wording) and an added prototype paragraph; no rule this repository added was removed.
`init` printed no warnings, and `check-specs.sh` and `npm test` pass locally.
