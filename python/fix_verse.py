"""
Surgically re-sync a single verse across all_verses, verses_to_words and
words_mass, using the (already-corrected) text file as the source of truth.

Unlike processtexts / processtexts3 (which are built to *append* whole books
and either clobber or double-count words_mass on an in-place edit), this diffs
the verse's new word counts against what verses_to_words currently holds and
applies only the delta to words_mass. It is idempotent: run it twice and the
second run is a no-op.

Usage (from anywhere):
    set -a; source python/vars.env; set +a      # load DATABASE_URL
    python python/fix_verse.py                   # dry run, prints the plan
    python python/fix_verse.py --apply           # actually write
"""

import os
import sys
import psycopg2

from library import bookToIDDict, cleanWord, cleanDiacritics

# ---- what to fix -----------------------------------------------------------
BOOK = "Genesis"
EDITION = "First Edition"
CHAPTER = 1
VERSE = 4
# ---------------------------------------------------------------------------

EDITION_PREFIX = {
    "First Edition": "2",
    "Second Edition": "3",
    "Mayhew": "5",
    "Zeroth Edition": "7",
}
EDITION_COLUMN = {
    "First Edition": "first_edition",
    "Second Edition": "second_edition",
    "Mayhew": "mayhew",
    "Zeroth Edition": "zeroth_edition",
}

APPLY = "--apply" in sys.argv

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit(
        "DATABASE_URL is not set. Run:  set -a; source python/vars.env; set +a"
    )

HERE = os.path.dirname(os.path.abspath(__file__))


def zpad(n):
    return str(n).zfill(3)


bookID = bookToIDDict[BOOK]
GENERIC_ID = int("1" + bookID + zpad(CHAPTER) + zpad(VERSE))            # all_verses key
EDITION_ID = int(EDITION_PREFIX[EDITION] + bookID + zpad(CHAPTER) + zpad(VERSE))
COLUMN = EDITION_COLUMN[EDITION]


def read_verse_text():
    """Pull the corrected verse line straight from the text file."""
    path = os.path.join(HERE, "..", "texts", f"{BOOK}.{EDITION}.txt")
    target = f"{CHAPTER}.{VERSE}"
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue
            parts = line.split()
            if parts[0] == target:
                return " ".join(parts[1:])
    raise SystemExit(f"Verse {target} not found in {path}")


def counts_from_text(text):
    counts = {}
    for token in text.split():
        w = cleanWord(token)
        if w == "":
            continue
        counts[w] = counts.get(w, 0) + 1
    return counts


def main():
    new_text = read_verse_text()
    new_counts = counts_from_text(new_text)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # --- old per-word counts for this verse, as currently aggregated ---------
    cur.execute(
        "SELECT words, counts FROM verses_to_words WHERE verse_id = %s",
        (EDITION_ID,),
    )
    row = cur.fetchone()
    old_counts = {}
    if row and row[0]:
        old_counts = {w: c for w, c in zip(row[0], row[1])}

    # --- per-word delta ------------------------------------------------------
    deltas = {}
    for w in set(old_counts) | set(new_counts):
        d = new_counts.get(w, 0) - old_counts.get(w, 0)
        if d != 0:
            deltas[w] = d

    print(f"Verse: {BOOK} {CHAPTER}:{VERSE} [{EDITION}]")
    print(f"  all_verses.verse_id     = {GENERIC_ID} (column {COLUMN})")
    print(f"  verses_to_words.verse_id = {EDITION_ID}")
    print(f"  new text: {new_text}")
    if not deltas:
        print("  words_mass: no word-count changes.")
    else:
        print("  words_mass deltas (verse count old -> new):")
        for w in sorted(deltas):
            print(f"    {w!r}: {old_counts.get(w, 0)} -> {new_counts.get(w, 0)}")

    if not APPLY:
        print("\nDRY RUN. Re-run with --apply to write these changes.")
        conn.close()
        return

    # --- 1. all_verses: raw text (idempotent upsert of the one column) -------
    cur.execute(
        f"UPDATE all_verses SET {COLUMN} = %s WHERE verse_id = %s",
        (new_text, GENERIC_ID),
    )
    if cur.rowcount == 0:
        cur.execute(
            f"INSERT INTO all_verses (verse_id, book, chapter, verse, {COLUMN}) "
            f"VALUES (%s, %s, %s, %s, %s)",
            (GENERIC_ID, BOOK, CHAPTER, VERSE, new_text),
        )

    # --- 2. verses_to_words: full replace of this verse's row ----------------
    words = sorted(new_counts)
    counts = [new_counts[w] for w in words]
    cur.execute(
        """
        INSERT INTO verses_to_words (verse_id, words, counts)
        VALUES (%s, %s::varchar[], %s::int2[])
        ON CONFLICT (verse_id) DO UPDATE
        SET words = EXCLUDED.words, counts = EXCLUDED.counts
        """,
        (EDITION_ID, words, counts),
    )

    # --- 3. words_mass: apply the delta per affected headword ----------------
    for w in sorted(deltas):
        cur.execute(
            "SELECT verses, counts, total_count FROM words_mass WHERE headword = %s",
            (w,),
        )
        wrow = cur.fetchone()
        new_c = new_counts.get(w, 0)

        if wrow is None:
            # brand-new headword (shouldn't happen for this edit)
            if new_c <= 0:
                continue
            editions = int(EDITION_PREFIX[EDITION])
            cur.execute(
                """
                INSERT INTO words_mass
                    (headword, verses, counts, editions, total_count, no_diacritics)
                VALUES (%s, %s::int8[], %s::int2[], %s, %s, %s)
                """,
                (w, [EDITION_ID], [new_c], editions, new_c, cleanDiacritics(w)),
            )
            continue

        verses = list(wrow[0] or [])
        wcounts = list(wrow[1] or [])
        idx = verses.index(EDITION_ID) if EDITION_ID in verses else None

        if new_c <= 0:
            # word no longer in this verse: drop this verse from the arrays
            if idx is not None:
                verses.pop(idx)
                wcounts.pop(idx)
        elif idx is not None:
            wcounts[idx] = new_c
        else:
            verses.append(EDITION_ID)
            wcounts.append(new_c)

        if not verses:
            cur.execute("DELETE FROM words_mass WHERE headword = %s", (w,))
        else:
            cur.execute(
                """
                UPDATE words_mass
                SET verses = %s::int8[], counts = %s::int2[], total_count = %s
                WHERE headword = %s
                """,
                (verses, wcounts, sum(wcounts), w),
            )

    conn.commit()
    conn.close()
    print("\nApplied.")


if __name__ == "__main__":
    main()
