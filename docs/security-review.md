# Security review: weekly-extract

`/security-review` of the `weekly-extract` change, run on 2026-11-07 at commit `4604dbb`. It covered
the workflow `.github/workflows/extract.yml` and every script the workflow runs.

**Result: no vulnerability at confidence 8 or above.** The reviewer traced every untrusted input to
every sensitive operation. The untrusted inputs are fork pull requests, Geofabrik downloads, region
artifacts and the previous `data` tree.

## The one low-confidence note, fixed anyway

The reviewer noted one issue at 3/10 confidence. A symbolic link to a folder in the previous `data`
tree would have been followed when files were carried over, because `lstat` checks only the last part
of a path. Planting one needs write access to `data` already, the reachable file names are fixed to
`<int>_<int>.json`, and no token is present in that step. It was fixed through the spec all the same:
a symbolic link anywhere in the previous tree now fails the deploy
(`test/assemble-site.test.mjs`, "a symbolic link in the previous tree fails").

## Checked and found sound

- **Triggers:** only `schedule` and `workflow_dispatch` (see [the attack test](attack-test.md)).
- **Permissions:** `contents: read` at the top level and on the plan and region jobs. Only `deploy`
  has `contents: write`.
- **The write token:**
  - every checkout sets `persist-credentials: false`;
  - the token is in the `env` of the push step only;
  - it reaches git as an `http.<url>.extraheader` through `GIT_CONFIG_*` environment variables, so
    it is never in argv, `.git/config` or the log;
  - the push refspec is fixed to `refs/heads/data`, and the push is leased.
- **Expressions:**
  - no `${{ }}` inside `run:`;
  - the region id comes in through `env:`, quoted, and is checked against `^[a-z0-9-]+$` from
    `regions.json`.
- **Actions:**
  - only GitHub's own, pinned by commit SHA;
  - `download-artifact` gets no `github-token` and no `run-id`, so it reads only this run's
    artifacts.
- **Command injection:** osmium is run with `execFile` and an argument array. Its arguments are
  script-built paths, bounds that are checked to be finite numbers, and fixed filter strings.
- **Geofabrik content:**
  - download URLs come from a path checked by regex;
  - OPL tags can't pollute the prototype (`Object.hasOwn`);
  - `title` reaches the output only through `JSON.stringify`;
  - coordinates are parsed as bounded decimals, so output paths can only be
    `<region>/<int>_<int>(/<int>_<int>).json`.
- **Region artifacts:**
  - only `region-<listed id>` folders are accepted;
  - inside one, only `entry.json`, `stats.json` and the region's own folder are allowed;
  - symbolic links and other non-regular files are rejected;
  - the file set must equal exactly what the entry lists;
  - sizes are capped;
  - the id, name and bounds must equal `regions.json`.

  So a compromised region job can change only the JSON content of its own cell files. It can't plant
  `_headers`, `index.html` or a path outside its folder.
- **Site files:** `_headers`, `404.html` and `manifest.json` are written from constants and checked
  entries. `404.html` holds no data, so it carries no XSS.
- **Deserialization:** `JSON.parse` only, and every result is checked against a schema.

## colorado-bounds-and-empty-push (2026-11-07)

`/security-review` of the change's code (`src/poly.mjs`, `src/build-region.mjs`, `src/publish.sh`,
the new `src/manifest-regions.mjs` and `regions.json`). **Result: no finding**, at any confidence.

Checked and found sound:

- **Outputs:** the new region count is only compared in shell. It is never written to
  `$GITHUB_OUTPUT`, which gets only the fixed strings `changed=true` and `changed=false`.
- **The publish decision:** the new check can only add a no-push exit, or a failure. A failed command
  substitution trips `set -e`. Nothing makes a run push that wouldn't have.
- **The token:** `prepare` and its node child still run without the token, and `push` is unchanged.
- **Input handling:**
  - the paths come from trusted runner variables, and are quoted;
  - the manifest is read with `JSON.parse` and shape-checked;
  - importing `assemble-site.mjs` doesn't run its command-line code.
- **The guard's message** holds only finite numbers that `parsePoly` has already checked. The reordered
  check still fails closed, and a corner on a ring is now rejected outright.
