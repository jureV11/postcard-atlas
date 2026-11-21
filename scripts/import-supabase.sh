#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f $1/public.dump || ! -f $1/users.csv || ! -f $1/media.sha256 || ! -f $1/objects.txt || ! -f $1/counts.tsv ]]; then
  echo 'Usage: scripts/import-supabase.sh EXPORT_DIRECTORY' >&2
  exit 2
fi
source ./.env
export_dir=$1
db() { docker compose --env-file .env exec -T db psql -U postgres -d postcard -At -v ON_ERROR_STOP=1 -c "$1" </dev/null; }
if [[ $(db 'select count(*) from public.groups') != 0 ]]; then
  echo 'Target database is not empty; import into a fresh stack.' >&2
  exit 1
fi
if [[ -s $export_dir/media.sha256 ]]; then
  (cd "$export_dir/storage" && sha256sum -c ../media.sha256)
fi
docker compose --env-file .env exec -T db psql -U postgres -d postcard -v ON_ERROR_STOP=1 \
  -c 'copy auth.users(id,email) from stdin with (format csv, header true)' < "$export_dir/users.csv"
docker compose --env-file .env exec -T db pg_restore -U postgres -d postcard \
  --data-only --disable-triggers --no-owner --no-privileges --exit-on-error < "$export_dir/public.dump"
mkdir -p "${UPLOAD_LOCATION:-./library}"
cp -a "$export_dir/storage/." "${UPLOAD_LOCATION:-./library}/"
docker compose --env-file .env run --rm --no-deps --user root web chown -R 1001:1001 /data
while IFS= read -r object; do
  if [[ ! -f ${UPLOAD_LOCATION:-./library}/$object ]]; then
    echo "Missing imported media: $object" >&2
    exit 1
  fi
done < "$export_dir/objects.txt"
echo 'Imported application rows and media. Enable the five user emails in auth.users before opening the site.'
while IFS=$'\t' read -r table expected; do
  actual=$(db "select count(*) from public.$table")
  if [[ $actual != "$expected" ]]; then
    echo "Row count mismatch for $table: source=$expected target=$actual" >&2
    exit 1
  fi
  echo "$table=$actual"
done < "$export_dir/counts.tsv"
