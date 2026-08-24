#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%m")
ARCHIVE="deploy/deploy-${TIMESTAMP}.zip"

echo "Building production bundle..."
bun run build

echo "Creating deploy directory..."
mkdir -p deploy

echo "Creating archive: ${ARCHIVE}"
(cd dist && zip -r "../${ARCHIVE}" .)

echo "Done: ${ARCHIVE}"
