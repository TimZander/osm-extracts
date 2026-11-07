#!/usr/bin/env bash
# Publishes the assembled site as one parentless commit on the data branch (spec: "Publishing
# replaces the site with one orphan commit").
#
#   bash src/publish.sh prepare <site-dir>   commit the tree as refs/osm/next, unless it equals the
#                                            previous data tree; writes changed=true|false to
#                                            $GITHUB_OUTPUT. Needs no credential.
#   bash src/publish.sh push                 force-push refs/osm/next to data, leased on the commit
#                                            fetch-previous.sh read. Needs GITHUB_TOKEN, which goes
#                                            to this one git process as an HTTP header and is never
#                                            written to .git/config.
set -euo pipefail

remote=${PUBLISH_REMOTE:-origin}
output=${GITHUB_OUTPUT:-/dev/null}

case ${1:-} in
  prepare)
    site=$(cd "${2:?usage: publish.sh prepare <site-dir>}" && pwd)
    gitdir=$(git rev-parse --absolute-git-dir)
    index=$(mktemp -u)
    trap 'rm -f "$index"' EXIT
    GIT_INDEX_FILE=$index git --git-dir="$gitdir" --work-tree="$site" -C "$site" \
      -c core.excludesFile=/dev/null -c core.autocrlf=false add -A --force -- .
    tree=$(GIT_INDEX_FILE=$index git --git-dir="$gitdir" write-tree)
    previous_tree=$(git rev-parse -q --verify 'refs/osm/previous^{tree}' || true)
    if [ "$tree" = "$previous_tree" ]; then
      echo "The site is unchanged since the last run: nothing to push."
      echo "changed=false" >> "$output"
      exit 0
    fi
    commit=$(GIT_AUTHOR_NAME='github-actions[bot]' GIT_AUTHOR_EMAIL='41898282+github-actions[bot]@users.noreply.github.com' \
      GIT_COMMITTER_NAME='github-actions[bot]' GIT_COMMITTER_EMAIL='41898282+github-actions[bot]@users.noreply.github.com' \
      git commit-tree "$tree" -m "OSM extract (run ${GITHUB_RUN_ID:-local})")
    git update-ref refs/osm/next "$commit"
    echo "New data commit $commit (tree $tree)."
    echo "changed=true" >> "$output"
    ;;
  push)
    if [ -z "${GITHUB_TOKEN:-}" ]; then
      echo "::error::GITHUB_TOKEN is not set."
      exit 1
    fi
    next=$(git rev-parse --verify refs/osm/next)
    previous=$(git rev-parse -q --verify refs/osm/previous || true)
    auth="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
    GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="http.${GITHUB_SERVER_URL:-https://github.com}/.extraheader" GIT_CONFIG_VALUE_0="$auth" \
      git push --force-with-lease="refs/heads/data:$previous" "$remote" "$next:refs/heads/data"
    echo "Pushed $next to data."
    ;;
  *)
    echo "usage: publish.sh prepare <site-dir> | publish.sh push" >&2
    exit 2
    ;;
esac
