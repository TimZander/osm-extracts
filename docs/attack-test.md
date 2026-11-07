# Attack test: the extract workflow

Run on 2026-11-07 against PR #2 (`claude/osm-pipeline`), for the high-risk rule in
`.claude/sdd-workflow.md`. This records what was tried, how, and what happened. Observed means seen in
GitHub's own run records. Reasoned means argued from the workflow file and GitHub's documented
behaviour.

| # | Attack | How | Result |
|---|---|---|---|
| 1 | A pull request runs the extract workflow | Opened PR #2, which adds `extract.yml`, then pushed two more commits to it (`c4053a5`, `ac71e3c`) | **Observed: refused.** The run list for the repository shows only `sdd-checks` (`pull_request_target`) and the probe below. No `extract` run exists. |
| 2 | A pull request that edits the workflow gets a token that can write | Pushed a throwaway workflow (`attack-probe.yml`, on `pull_request`, no `permissions:` block) in `ac71e3c`, read its "GITHUB_TOKEN Permissions" log block (run 42322637514), then removed it in the next commit | **Observed: the default token is read-only:** `Contents: read`, `Metadata: read`, `Packages: read`. This confirms the owner-reported setting. |
| 3 | A fork pull request runs the workflow, or one of its own that can write | No fork was available: the owner can't fork their own repository into the same account, and this session can't create one | **Reasoned: refused.** `extract.yml` has no `pull_request*` trigger, so a fork's PR can't start it (as #1 observed). A fork could add its own `on: pull_request` workflow. GitHub then runs it from the fork's files, only after the owner approves (the owner-reported setting), and always with a read-only token and no secrets, whatever `permissions:` it asks for. So it can't push `data`. |
| 4 | Only the deploy job writes | `test/workflow.test.mjs` reads the workflow file | **Observed (test): passes.** Top-level, `plan` and `region` have `contents: read`. Only `deploy` has `contents: write`. `github.token` appears once, in the push step's `env`. |
| 5 | A secret is referenced | `test/workflow.test.mjs`, and a search of the file | **Observed (test): none.** No `secrets.` reference, no `ACTIONS_STEP_DEBUG` and no `${{ }}` inside `run:`. Every `uses:` is an `actions/*` SHA pin. |
| 6 | A same-repository branch edits the workflow to push `data` | Reasoned | **Not a new capability.** A same-repository PR needs push access, which can already push `data` directly. GitHub honours `permissions:` for a same-repository PR (attack #2 shows only the default). |
| 7 | A compromised region job plants files in the site | `test/assemble-site.test.mjs`, "stray or malformed artifacts…" (12 cases) and "an artifact for a region not on the list…" | **Observed (test): refused.** The deploy fails, naming the region, and nothing is written. |

The probe workflow existed only in commit `ac71e3c` and was removed in the next commit, before
review. It never had more than the default read-only token, and it ran only `echo`.

Still open after merge: the first `workflow_dispatch` run, with the owner's go, shows the deploy job's
`GITHUB_TOKEN Permissions` block as `Contents: write`, and the region jobs' as `Contents: read`.

## colorado-bounds-and-empty-push: the publish decision (2026-11-07)

This run used the real `src/fetch-previous.sh` and `src/publish.sh` against a local bare repository
whose `data` held a placeholder. For each crafted site, `publish.sh prepare` ran first, then
`publish.sh push` was forced anyway.

| Site's `manifest.json` | `prepare` | Output | Forced `push` | `data` |
|---|---|---|---|---|
| `{"attribution":"a","regions":[]}` | exit 0, "The new manifest lists no region: nothing to push." | `changed=false` | fails (no prepared commit) | unchanged |
| missing | exit 1, "no valid manifest.json: ENOENT…" | none | fails | unchanged |
| `new` (not JSON) | exit 1, "…is not valid JSON" | none | fails | unchanged |
| `{}` | exit 1, "…has no attribution string" | none | fails | unchanged |
| `{"attribution":"a","regions":"x"}` | exit 1, "…has no regions array" | none | fails | unchanged |

**Every input was refused.** In the workflow, the push step runs only on `changed == 'true'`, so it
doesn't even start in these cases.
