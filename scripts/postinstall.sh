#!/usr/bin/env bash

set -euo pipefail

if [[ ! -f "scripts/postinstall.mjs" ]]; then
  echo "Skipping repo postinstall helper: scripts/postinstall.mjs is not present in this install context."
  exit 0
fi

exec node scripts/postinstall.mjs
