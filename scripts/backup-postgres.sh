#!/bin/sh
set -eu

# Keep private backups outside the active database volume.
umask 077
backup_dir="${BACKUP_DIR:-/backups}"
keep="${BACKUP_RETENTION:-7}"
case "$keep" in
  ''|*[!0-9]*) echo "Invalid BACKUP_RETENTION" >&2; exit 2 ;;
esac
if [ "$keep" -lt 7 ]; then
  echo "BACKUP_RETENTION must be at least 7" >&2
  exit 2
fi

mkdir -p "$backup_dir"
day="$(date -u +%Y%m%d)"
target="$backup_dir/techpro-$day.dump"

if [ -s "$target" ]; then
  pg_restore --list "$target" > /dev/null
  echo "Backup already exists for UTC day $day"
  exit 0
fi

temp="$(mktemp "$backup_dir/.techpro-XXXXXXXX.dump")"
trap 'rm -f "$temp"' EXIT HUP INT TERM
pg_dump --format=custom --no-owner --no-acl --file="$temp"
pg_restore --list "$temp" > /dev/null
mv "$temp" "$target"
trap - EXIT HUP INT TERM
echo "PostgreSQL backup created: $target"

# Retain the newest 7 daily copies (or BACKUP_RETENTION if greater).
ls -1t "$backup_dir"/techpro-*.dump | tail -n "+$((keep + 1))" |
  while IFS= read -r old; do
    [ -f "$old" ] && rm -f "$old"
  done
