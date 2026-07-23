#!/bin/sh
# Database backup. The Postgres volume is the only thing here that cannot be
# rebuilt: videos and recordings live in object storage, and everything else is
# a container away from being recreated.
#
#   ./backup.sh              -> ./backups/micacademia-YYYY-MM-DD.sql.gz
#   BACKUP_DIR=/mnt/nas ./backup.sh
#
# Nightly, from the server's crontab:
#   0 3 * * * cd /srv/micacademia/mica && ./backup.sh >> backups/backup.log 2>&1
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
# How many daily dumps to keep. Older ones are deleted at the end.
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
target="$BACKUP_DIR/micacademia-$(date +%F).sql.gz"

echo "Dumping the database to $target"
# Write to a temporary name first: an interrupted dump must not overwrite
# yesterday's good backup with a truncated file.
docker compose exec -T postgres pg_dump -U micacademia -d micacademia | gzip > "$target.partial"
mv "$target.partial" "$target"

echo "Removing dumps older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name 'micacademia-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

echo "Done: $(du -h "$target" | cut -f1)"
