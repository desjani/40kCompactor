#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
FULL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
TS=$(git show -s --format=%cI HEAD 2>/dev/null || date -Iseconds)

cat << EOF > build_meta.json
{
  "commitShort": "${SHORT}",
  "commitFull": "${FULL}",
  "timestamp": "${TS}"
}
EOF
echo "Wrote build_meta.json:"
cat build_meta.json
