#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -r "$1" ]; then
  echo "Usage: sh scripts/verify-backup.sh /path/to/techpro-YYYYMMDD.dump" >&2
  exit 2
fi

archive="$1"
container="techpro-backup-check-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM

# Trust auth is limited to a disposable PostgreSQL with no network or ports.
docker run --detach --rm --network none --name "$container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine > /dev/null

attempt=0
until docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Disposable PostgreSQL did not become ready" >&2
    exit 1
  fi
  sleep 1
done

docker exec "$container" createdb -U postgres techpro_verify
docker exec -i "$container" pg_restore --exit-on-error --no-owner --no-acl \
  -U postgres -d techpro_verify < "$archive"

tables="$(docker exec "$container" psql -U postgres -d techpro_verify -Atc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")"
if [ "$tables" -le 0 ]; then
  echo "Restore verification failed: no application tables" >&2
  exit 1
fi
echo "Restore verification passed: $tables public tables"
