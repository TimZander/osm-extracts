---
status: accepted
date: 2026-11-07
decision-makers: Claude (proposed in the weekly-extract change); accepted by the owner on 2026-11-07 (weekly-extract open question 9)
---
# The extract workflow runs only on a schedule or by hand, and only its deploy job can write

## Context and Problem Statement

The deploy job needs `contents: write` to push `data`, and that token can write the whole repository,
`main` included. The repository is public, so anyone can open a pull request. The region jobs parse
third-party data with third-party tools.

## Considered Options

- Triggers `schedule` and `workflow_dispatch` only; one writing job; SHA-pinned GitHub actions only; artifacts checked before use
- Also build on `pull_request`, to preview changes
- One job that builds and pushes

## Decision Outcome

Chosen option: the first, because nothing someone without write access can cause starts the
workflow, and a compromised build step holds no credential that can push. In detail:

- Top-level `permissions: contents: read`. The plan and region jobs have `contents: read`. The deploy
  job alone has `contents: write`.
- Every checkout sets `persist-credentials: false`. The token goes to the deploy job's checkout and to
  its push step, which passes it to that one `git push` as an HTTP header in its environment, never
  in `.git/config`.
- Only `actions/checkout`, `actions/upload-artifact` and `actions/download-artifact`, each pinned by
  commit SHA. `download-artifact` gets no `github-token` input, so it never sees the write token. The
  draft allowed only `checkout` in the deploy job. The alternative was fetching artifacts from the
  REST API with the token in shell, which would spread the token to more code.
- No `actions/setup-node`: it takes `github.token` by default. The runner image's Node is used.
- No repository secret, no `ACTIONS_STEP_DEBUG`, no `${{ }}` inside `run:`, and `workflow_dispatch`
  takes no inputs.
- The deploy job checks each region artifact: the id, name and bounds must equal the list's, the file
  set must be exactly what the entry lists, the files must be regular, and none may be over 20 MiB.
- One concurrency group with no cancel-in-progress, and a push leased on the `data` commit the run
  read.

### Consequences

- Good, because a pull request, even one that edits the workflow, can't push `data`. GitHub runs a
  fork's workflow (once its run is approved) with a read-only token and no secrets.
- Good, because the workflow's tests pin every one of these properties.
- Bad, because there is no preview build of a pull request. Changes are tested locally against
  fixtures.
