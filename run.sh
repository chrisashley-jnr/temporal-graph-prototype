#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [ ! -x .venv/bin/python ]; then
  proto_python=""
  for candidate in python3.12 python3.13 python3.14 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; assert (3,11)<=sys.version_info[:2]<(3,15)' >/dev/null 2>&1; then
      proto_python="$candidate"
      break
    fi
  done
  if [ -z "$proto_python" ]; then
    echo "Install Python 3.12, then run bash run.sh again."
    exit 1
  fi
  "$proto_python" -m venv .venv
fi
if ! .venv/bin/python -c 'import torch, sklearn, numpy' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -r requirements-lock.txt
fi
if [ ! -f dist/index.html ]; then
  echo "The compiled interface is missing. Run npm ci && npm run build first."
  exit 1
fi
exec .venv/bin/python -m backend.server "$@"
