"""Reversify the Hebrew Psalms onto the DB's numbering and write
../texts/Psalms (prose).Grebrew.txt.

The DB stores each psalm superscription as verse 0. Three cases per psalm:
  - plain (DB has no verse 0): Hebrew verse v -> DB verse v.
  - Type A (DB has verse 0; the superscription is its own Hebrew verse(s)):
    fold the first S Hebrew verses into DB verse 0, shift the rest down by S.
  - Type B (DB has verse 0; the superscription is fused into Hebrew verse 1):
    split Hebrew v1 at the poetic boundary (paseq / oleh-we-yored / atnach) ->
    superscription to verse 0, remainder to verse 1; shift the rest down by 1.

Ps 13 is special (superscription is its own verse AND its last verse splits in
the KJV) and is handled with the split books, not here.

Run from python/. Use --write to also emit the .txt; default is dry-run report.
"""
import re
import sys
import xml.etree.ElementTree as ET

import psycopg2

from hebrewmanager import process_word_elements, word_text

ATNACH = 0x0591
OLE = 0x05AB
PASEQ = 0x05C0

# Superscription boundaries the accent rule can't infer (a single-word title
# whose body's first major accent/paseq falls mid-line). Value = word count.
#   25, 28: bare לְדָוִד before an אֵלֶיךָ acrostic.
#   98:     bare מִזְמוֹר before שִׁירוּ לַיהוָה (paseq is mid-body).
SPECIAL_CUT = {25: 1, 28: 1, 98: 1}
# Handled with the split books (fold + final-verse split), not by this script.
SKIP = {13}

BOOK_ID = "019"


def load_env(path="vars.env"):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                import os
                os.environ.setdefault(k.strip(), v.strip())


def db_target():
    """Per chapter, the sorted list of DB verse numbers (the target numbering)."""
    import os
    load_env()
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("""SELECT (verse_id/1000)%1000 AS ch, verse FROM all_verses
                   WHERE verse_id BETWEEN 1019000000 AND 1019999999 ORDER BY ch, verse""")
    d = {}
    for ch, v in cur.fetchall():
        d.setdefault(int(ch), []).append(int(v))
    cur.close(); conn.close()
    return d


def word_elements(verse):
    return [e for e in verse if e.tag in ("w", "k", "q")]


def accents(text):
    return [ord(c) for c in (text or "") if 0x0591 <= ord(c) <= 0x05AF]


def superscription_cut(words):
    """Return how many leading words are the superscription, by the earliest of
    an early paseq, oleh-we-yored, or atnach."""
    cands = []
    for i, w in enumerate(words[:4]):
        if chr(PASEQ) in word_text(w):
            cands.append(i + 1)
            break
    for i, w in enumerate(words):
        if OLE in accents(word_text(w)):
            cands.append(i + 1); break
    for i, w in enumerate(words):
        if ATNACH in accents(word_text(w)):
            cands.append(i + 1); break
    return min(cands) if cands else len(words)


def process(write=False):
    target = db_target()
    book = ET.parse("../Hebrew XML/Psalms.xml").getroot().find(".//book")
    heb = {int(c.get("n")): c.findall("v") for c in book.findall("c")}

    out = []           # (ch, v, body)
    report = {"plain": [], "typeA": [], "typeB": [], "skip": []}
    problems = []

    for ch in sorted(heb):
        verses = heb[ch]
        H = len(verses)
        tgt = target.get(ch, [])
        has0 = bool(tgt) and tgt[0] == 0
        if ch in SKIP:
            report["skip"].append(ch)
            continue

        def body(v):  # process a whole Hebrew verse element
            return process_word_elements(list(v), "Psalms", [], {})

        if not has0:  # plain
            for i, v in enumerate(verses, start=1):
                out.append((ch, i, body(v)))
            report["plain"].append(ch)
        else:
            S = H - (len(tgt) - 1)  # superscription Hebrew verses folded into v0
            if S >= 1:  # Type A: fold first S verses into verse 0
                sup_elems = []
                for v in verses[:S]:
                    sup_elems += word_elements(v)
                out.append((ch, 0, process_word_elements(sup_elems, "Psalms", [], {})))
                for i, v in enumerate(verses[S:], start=1):
                    out.append((ch, i, body(v)))
                report["typeA"].append((ch, S))
            else:  # Type B: split Hebrew v1 into verse 0 + verse 1
                words = word_elements(verses[0])
                cut = SPECIAL_CUT.get(ch) or superscription_cut(words)
                sup = process_word_elements(words[:cut], "Psalms", [], {})
                # Drop a trailing paseq (a divider, not part of the title).
                sup = re.sub(r"\s*׀\s*$", "", sup)
                first = process_word_elements(words[cut:], "Psalms", [], {})
                out.append((ch, 0, sup))
                out.append((ch, 1, first))
                for i, v in enumerate(verses[1:], start=2):
                    out.append((ch, i, body(v)))
                report["typeB"].append((ch, cut, sup))

        # verify this chapter's produced verse set matches the DB target
        produced = sorted(v for (c, v, _) in out if c == ch)
        if ch not in SKIP and produced != sorted(tgt):
            problems.append((ch, produced, sorted(tgt)))

    # report
    print(f"plain psalms: {len(report['plain'])}")
    print(f"Type A (fold): {len(report['typeA'])}  e.g. {report['typeA'][:5]}")
    print(f"Type B (split): {len(report['typeB'])}")
    print(f"skipped (special): {sorted(report['skip'])}")
    print(f"\nverse-count problems: {problems if problems else 'NONE'}")
    print("\n--- all Type B superscription cuts (v0 | v1-start) ---")
    for ch, cut, sup in report["typeB"]:
        first = next(b for (c, v, b) in out if c == ch and v == 1)
        print(f"  Ps {ch:3}: v0='{sup}'  |  v1='{first[:40]}...'")

    if write:
        with open("../texts/Psalms (prose).Grebrew.txt", "w", encoding="utf-8") as f:
            for ch, v, b in out:
                f.write(f"{ch}.{v} {b}\n")
        print(f"\nWrote ../texts/Psalms (prose).Grebrew.txt ({len(out)} verses)")


if __name__ == "__main__":
    process(write="--write" in sys.argv)
