#!/usr/bin/env python3
"""Rebuild texts/{Book}.Grebrew.txt files from tr-intermediate.txt.

tr-intermediate.txt is the corrected Textus Receptus NT text, already
reversified to KJV chapter/verse numbering. It's organized as:

    [BookName]
    N.M. verse text
    N.M. verse text
    ...

This script splits it by book and overwrites the matching
../texts/{BookName}.Grebrew.txt with one verse per line in the format
the site expects: "chapter.verse text" (no period after the address),
fixing two known OCR/font substitution artifacts along the way:

    ∆ (U+2206 INCREMENT)      -> Δ (U+0394 GREEK CAPITAL LETTER DELTA)
    • (U+2022 BULLET)         -> · (U+00B7 MIDDLE DOT)

Usage (run from the python/ directory):
    python3 build_grebrew_from_intermediate.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INTERMEDIATE = ROOT / "tr-intermediate.txt"
TEXTS_DIR = ROOT / "texts"

VERSE_RE = re.compile(r"^(\d+)\.(\d+)\.\s?(.*)$")

CHAR_FIXES = {
    "∆": "Δ",  # ∆ -> Δ
    "•": "·",  # • -> ·
}


def fix_chars(text):
    for bad, good in CHAR_FIXES.items():
        text = text.replace(bad, good)
    return text


def parse_books(path):
    """Return {book_name: [(chapter, verse, text), ...]} in file order."""
    books = {}
    book_order = []
    current = None
    with open(path, encoding="utf-8") as f:
        for lineno, raw_line in enumerate(f, 1):
            line = raw_line.rstrip("\n")
            if not line.strip():
                continue
            if line.startswith("["):
                current = line.strip("[]")
                books[current] = []
                book_order.append(current)
                continue
            m = VERSE_RE.match(line)
            if not m:
                raise ValueError(f"Line {lineno}: unparseable line: {line!r}")
            chapter, verse, text = m.groups()
            books[current].append((int(chapter), int(verse), fix_chars(text)))
    return books, book_order


def write_book(book_name, verses):
    path = TEXTS_DIR / f"{book_name}.Grebrew.txt"
    lines = [f"{chapter}.{verse} {text}" for chapter, verse, text in verses]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path, len(lines)


def main():
    books, book_order = parse_books(INTERMEDIATE)
    for book_name in book_order:
        path, count = write_book(book_name, books[book_name])
        print(f"Wrote {count} verses to {path.relative_to(ROOT)}")
    print(f"Done: {len(book_order)} books.")


if __name__ == "__main__":
    main()
