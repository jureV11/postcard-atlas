#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z ${SOURCE_DATABASE_URL:-} ]]; then
  echo 'Usage: SOURCE_DATABASE_URL=... scripts/export-supabase.sh EXPORT_DIRECTORY' >&2
  exit 2
fi
destination=$1
mkdir -p "$destination/storage"
for bucket in avatars postcards meetups private-postcards; do
  mkdir -p "$destination/storage/$bucket"
done
psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c \
  "select 'public.postcard_comments'::regclass, 'public.postcard_reactions'::regclass, (select count(*) from information_schema.columns where table_schema='public' and table_name='postcards' and column_name='hand_delivered')" \
  | grep -q '|1$' || { echo 'Source schema is older than migration 0024.' >&2; exit 1; }

# Run only by the project owner after writes are paused. No source credentials are stored in the export.
pg_dump "$SOURCE_DATABASE_URL" --format=custom --data-only --schema=public \
  --exclude-table-data=public.push_config --file="$destination/public.dump"
psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "copy (select id, email from auth.users where email is not null) to stdout with (format csv, header true)" \
  > "$destination/users.csv"
psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "copy (select bucket_id || '/' || name from storage.objects where bucket_id in ('avatars','postcards','meetups','private-postcards') order by bucket_id,name) to stdout" \
  > "$destination/objects.txt"
tables=(groups members postcards member_addresses push_subscriptions meetups meetup_members meetup_notes meetup_photos private_postcards inbox_messages member_achievements postcard_reactions postcard_comments)
: > "$destination/counts.tsv"
for table in "${tables[@]}"; do
  count=$(psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "select count(*) from public.$table")
  printf '%s\t%s\n' "$table" "$count" >> "$destination/counts.tsv"
done
for bucket in avatars postcards meetups private-postcards; do
  supabase storage cp --remote --experimental --recursive "ss:///$bucket" "$destination/storage/$bucket"
done
while IFS= read -r object; do
  if [[ ! -f $destination/storage/$object ]]; then
    echo "Missing downloaded object: $object" >&2
    exit 1
  fi
done < "$destination/objects.txt"
(cd "$destination/storage" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) > "$destination/media.sha256"
echo "Exported to $destination. Keep this directory private."
