#!/bin/sh
set -eu

base="${1:-https://app.matbdev.com}"
case "$base" in
  https://*) ;;
  *) echo "An HTTPS base URL is required" >&2; exit 2 ;;
esac
base="${base%/}"

check() {
  path="$1"
  expected="$2"
  actual="$(curl --silent --show-error --max-time 15 --output /dev/null \
    --write-out '%{http_code}' "$base$path")"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $path returned $actual (expected $expected)" >&2
    exit 1
  fi
  echo "OK: $path -> $expected"
}

# Read-only checks; no credentials, no writes, no test records.
check "/login" 200
check "/api/health" 200
check "/api/quotes" 401
check "/api/warranties" 401
check "/api/revisions" 401
check "/api/dashboard" 401
