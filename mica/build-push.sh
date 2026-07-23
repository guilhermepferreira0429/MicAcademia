#!/bin/sh
# Builds the three application images here and pushes them to the registry, so
# the server only ever pulls. Run it from this folder, on a machine with the
# repository checked out.
#
#   ./build-push.sh            # tag from .env (MICA_VERSION)
#   ./build-push.sh 1.0.0      # tag explicitly
#
# The prefix and the default tag come from .env, the same file the server uses,
# so what you build is named exactly what the compose expects to pull.
set -eu

cd "$(dirname "$0")"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

PREFIX="${MICA_IMAGE_PREFIX:-}"
VERSION="${1:-${MICA_VERSION:-latest}}"

if [ -z "$PREFIX" ]; then
  echo "MICA_IMAGE_PREFIX is not set — put it in mica/.env (e.g. ghcr.io/<user>)." >&2
  exit 1
fi

# The Dockerfiles need the whole workspace, so the build context is the
# repository root even though this script lives one level down.
ROOT="$(cd .. && pwd)"

for name in api dashboard jobs; do
  image="$PREFIX/micacademia-$name:$VERSION"
  echo
  echo "==> Building $image"
  # --pull so a stale local base image does not quietly ship to production.
  docker build --pull -f "$ROOT/docker/Dockerfile.$name" -t "$image" "$ROOT"

  # Also move the `latest` tag when building a real version, so pre-production
  # follows without having to be told a number.
  if [ "$VERSION" != "latest" ]; then
    docker tag "$image" "$PREFIX/micacademia-$name:latest"
  fi
done

for name in api dashboard jobs; do
  echo
  echo "==> Pushing micacademia-$name:$VERSION"
  docker push "$PREFIX/micacademia-$name:$VERSION"
  if [ "$VERSION" != "latest" ]; then
    docker push "$PREFIX/micacademia-$name:latest"
  fi
done

echo
echo "Done. On the server:  docker compose pull && docker compose up -d"
