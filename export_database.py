#!/usr/bin/env python3
"""
Database Export Script
Exports all SQLite database tables to JSON files with dbbackup_ prefix

Usage:
    python export_database.py

No external dependencies required - uses only Python standard library (sqlite3, json)
"""

import sqlite3
import json
import os
import sys
from datetime import datetime
from pathlib import Path


def get_all_tables(connection):
    """Get list of all tables in the database"""
    cursor = connection.cursor()
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return tables


def convert_to_serializable(obj):
    """Convert non-JSON-serializable objects to strings"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    return str(obj)


def export_table_to_json(connection, table_name):
    """Export a single table to a dictionary"""
    cursor = connection.cursor()

    # Get column names
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]

    # Get all rows
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()

    cursor.close()

    # Convert to list of dictionaries
    data = []
    for row in rows:
        row_dict = {}
        for i, col in enumerate(columns):
            row_dict[col] = convert_to_serializable(row[i])
        data.append(row_dict)

    return data


def main():
    # Get paths
    script_dir = Path(__file__).parent
    db_path = script_dir / "prisma" / "dev.db"
    backup_dir = script_dir.parent / "dbBackup"

    # Check if database exists
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        print(f"\nPlease ensure the database file exists in: prisma/dev.db")
        sys.exit(1)

    # Create backup directory if it doesn't exist
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Get timestamp for filenames
    timestamp = datetime.now().strftime("%Y-%m-%d")

    print("\n📦 Starting database export...\n")
    print(f"📁 Database: {db_path}")
    print(f"💾 Output:   {backup_dir}\n")

    try:
        # Connect to database
        connection = sqlite3.connect(str(db_path))
        connection.row_factory = sqlite3.Row

        # Get all tables
        tables = get_all_tables(connection)

        if not tables:
            print("⚠️  No tables found in database")
            connection.close()
            sys.exit(1)

        print(f"Found {len(tables)} tables to export:\n")

        export_summary = {}
        total_rows = 0
        start_time = datetime.now()

        # Export each table
        for table in sorted(tables):
            try:
                # Export table
                data = export_table_to_json(connection, table)
                row_count = len(data)
                total_rows += row_count

                # Create export data structure
                export_data = {
                    "table": table,
                    "timestamp": datetime.now().isoformat(),
                    "rowCount": row_count,
                    "data": data
                }

                # Write to JSON file
                filename = f"dbbackup_{table}_{timestamp}.json"
                filepath = backup_dir / filename

                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, indent=2, default=str)

                export_summary[table] = row_count
                print(f"✓ {table.ljust(40)} : {str(row_count).rjust(6)} rows")

            except Exception as e:
                print(f"✗ {table.ljust(40)} : {str(e)[:50]}")
                export_summary[table] = 0

        connection.close()

        # Create summary file
        duration = (datetime.now() - start_time).total_seconds() * 1000
        summary_filename = f"dbbackup_EXPORT_SUMMARY_{timestamp}.json"
        summary_filepath = backup_dir / summary_filename

        summary = {
            "exportTimestamp": datetime.now().isoformat(),
            "databaseFile": str(db_path),
            "backupDirectory": str(backup_dir),
            "totalTables": len(export_summary),
            "totalRows": total_rows,
            "exportDurationMs": int(duration),
            "tables": export_summary
        }

        with open(summary_filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        # Print summary
        print("\n" + "=" * 70)
        print("✅ DATABASE EXPORT COMPLETE")
        print("=" * 70)
        print(f"📊 Tables exported    : {len(export_summary)}")
        print(f"📈 Total rows         : {total_rows:,}")
        print(f"⏱️  Time taken         : {duration:.0f}ms")
        print(f"📁 Backup directory   : {backup_dir}")
        print(f"📋 Summary file       : {summary_filename}")
        print("=" * 70 + "\n")

        # List created files
        print("Files created:")
        for table in sorted(export_summary.keys()):
            count = export_summary[table]
            icon = "✓" if count > 0 else "○"
            print(f"  {icon} dbbackup_{table}_{timestamp}.json ({count} rows)")
        print(f"  📋 {summary_filename}\n")

        print("✨ Database backup complete! All files saved to dbBackup folder.\n")

    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
