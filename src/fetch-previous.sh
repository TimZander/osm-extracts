#!/usr/bin/env bash
# Reads the previous site from the data branch into a folder (spec: "The previous site is read from
# the data branch"), and records its commit as refs/osm/previous for publish.sh. The repository is
# public, so this needs no credential. No data branch yet means an empty folder.
#
#   bash src/fetch-previous.sh <dir>
set -euo pipefail

dest=${1:?usage: fetch-previous.sh <dir>}
remote=${PUBLISH_REMOTE:-origin}
mkdir -p "$dest"

set +e
git ls-remote --exit-code --heads "$remote" refs/heads/data >/dev/null
status=$?
set -e
case $status in
  0)
    git fetch -q --no-tags --depth=1 "$remote" +refs/heads/data:refs/osm/previous
    git archive refs/osm/previous | tar -x -C "$dest"
    echo "Previous data commit: $(git rev-parse refs/osm/previous)"
    ;;
  2)
    git update-ref -d refs/osm/previous 2>/dev/null || true
    echo "No data branch yet: starting from an empty site."
    ;;
  *)
    echo "::error::Couldn't read the data branch (git ls-remote exited $status)."
    exit 1
    ;;
esac
