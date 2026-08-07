#!/usr/bin/env python3
"""Add chapter numbers to the verse-numbered TR text.

Reads tr-raw.txt and writes tr-processed.txt (overwriting it). tr-raw.txt is
never modified.

Input format:
    [BookName]        - a book header; resets the chapter count
    N. some text      - a verse, numbered within its chapter

A new chapter begins whenever the verse number does not increase from the
previous verse (verses always start at 1 and count up within a chapter). Each
verse line is rewritten so that e.g. verse 3 of chapter 12 becomes
"12.3. some text" instead of "3. some text". Book headers are passed through
unchanged.
"""

import re
from pathlib import Path

# The text files live in the repo root, one level up from this script.
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tr-raw.txt"
OUT = ROOT / "tr-processed.txt"

# Matches a leading verse number and the "." separator, capturing the rest.
VERSE_RE = re.compile(r"^(\d+)\.(.*)$", re.DOTALL)


def main() -> None:
    lines = RAW.read_text(encoding="utf-8").splitlines(keepends=True)

    out_lines = []
    chapter = 0
    prev_verse = 0

    for line in lines:
        if line.startswith("["):
            # Book header: reset chapter tracking, pass through unchanged.
            chapter = 0
            prev_verse = 0
            out_lines.append(line)
            continue

        m = VERSE_RE.match(line)
        if not m:
            # Unexpected line; leave it untouched.
            out_lines.append(line)
            continue

        verse = int(m.group(1))
        rest = m.group(2)

        # A verse number that doesn't increase marks a new chapter.
        if verse <= prev_verse or chapter == 0:
            chapter += 1
        prev_verse = verse

        out_lines.append(f"{chapter}.{verse}.{rest}")

    OUT.write_text("".join(out_lines), encoding="utf-8")
    print(f"Wrote {OUT.name} ({len(out_lines)} lines).")


if __name__ == "__main__":
    main()
