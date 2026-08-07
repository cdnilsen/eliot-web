"""Ingest a reversified Hebrew book into all_verses.grebrew.

Reads ../texts/{Book}.Grebrew.txt (produced by hebrewmanager.generate_grebrew_file,
already reversified to KJV numbering) and writes each verse into the `grebrew`
column of the matching all_verses row.

Safe by design: it only UPDATEs existing rows matched by verse_id (never INSERTs
or DELETEs). Any verse_id with no matching row is reported, not created, so a
versification error surfaces loudly instead of silently adding stray rows.

Usage (run from the python/ directory):
    python3 ingest_grebrew.py Genesis --dry-run   # parse + report, no DB write
    python3 ingest_grebrew.py Genesis             # write to grebrew
"""
import os
import sys

import psycopg2

from library import bookToIDDict

def load_env(path="vars.env"):
    """Populate os.environ from a KEY=VALUE env file (gitignored creds)."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())


def z3(n):
    return str(int(n)).zfill(3)


def parse_grebrew_file(book_name):
    """Return a list of (verse_id, text) from ../texts/{book}.Grebrew.txt."""
    book_id = bookToIDDict[book_name]
    path = f"../texts/{book_name}.Grebrew.txt"
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            addr, _, text = line.partition(" ")
            chapter, verse = addr.split(".")
            verse_id = int("1" + book_id + z3(chapter) + z3(verse))
            rows.append((verse_id, text))
    return rows


def ingest(book_name, dry_run=False):
    load_env()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set (expected in python/vars.env).")

    rows = parse_grebrew_file(book_name)
    print(f"{book_name}: parsed {len(rows)} verses from ../texts/{book_name}.Grebrew.txt")
    if dry_run:
        print("--dry-run: no database changes made.")
        return

    connection = psycopg2.connect(database_url)
    cursor = connection.cursor()
    matched, missing = 0, []
    for verse_id, text in rows:
        cursor.execute(
            "UPDATE all_verses SET grebrew = %s WHERE verse_id = %s",
            (text, verse_id),
        )
        if cursor.rowcount == 1:
            matched += 1
        else:
            missing.append(verse_id)
    connection.commit()
    cursor.close()
    connection.close()

    print(f"Updated grebrew on {matched} rows.")
    if missing:
        print(f"WARNING: {len(missing)} verse_ids had no matching all_verses row:")
        print("  " + ", ".join(str(v) for v in missing[:30]))
    else:
        print("All verses matched an existing row.")


NTBooks = [
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation",
]

if __name__ == "__main__":

    for book in NTBooks:
        ingest(book, dry_run="--dry-run" in sys.argv)
        
