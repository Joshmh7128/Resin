#!/usr/bin/env bash
# Takes a consistent SQLite backup (safe to run against a live database — uses
# SQLite's own .backup command rather than copying the file, which can catch
# it mid-write). Run daily via resin-backup.timer. Keeps the last 14 days.
set -euo pipefail

SRC="/opt/resin/prisma/dev.db"
DEST_DIR="/home/resin/backups"
KEEP=14

mkdir -p "$DEST_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 "$SRC" ".backup '$DEST_DIR/dev-$TIMESTAMP.db'"

# Prune everything past the most recent $KEEP backups.
ls -1t "$DEST_DIR"/dev-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "Backed up $SRC to $DEST_DIR/dev-$TIMESTAMP.db"
