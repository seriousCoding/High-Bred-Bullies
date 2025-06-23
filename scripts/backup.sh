#!/bin/bash

# High Bred Bullies - Database Backup Script
set -e

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="high-bred-bullies_db_1"

echo "📦 High Bred Bullies - Database Backup"
echo "====================================="

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Check if database container is running
if ! docker ps | grep -q $DB_CONTAINER; then
    echo "❌ Database container is not running"
    exit 1
fi

# Create database backup
echo "🗄️  Creating database backup..."
docker exec $DB_CONTAINER pg_dump -U postgres high_bred_bullies > "$BACKUP_DIR/backup_$DATE.sql"

# Compress the backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Remove backups older than 30 days
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "✅ Backup completed: $BACKUP_DIR/backup_$DATE.sql.gz"
echo "📊 Current backups:"
ls -lh $BACKUP_DIR/