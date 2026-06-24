"""
Diagnose broken review submission for Synapdeck decks.
Run with: py -3.12 diagnose_review.py [deck_name]
Default deck: Akkadian
"""

import sys
import os
import psycopg2

DATABASE_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://postgres:Cb4-D5B2BEEg6*GBBB*Fga*b5FE6CbfF@monorail.proxy.rlwy.net:14224/railway'
)

DECK = sys.argv[1] if len(sys.argv) > 1 else 'Akkadian'

def run(conn, label, sql, params=()):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print('='*60)
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    if not rows:
        print("  (no rows)")
    else:
        col_widths = [max(len(str(c)), max(len(str(r[i])) for r in rows)) for i, c in enumerate(cols)]
        header = "  " + "  ".join(str(c).ljust(col_widths[i]) for i, c in enumerate(cols))
        print(header)
        print("  " + "-" * (len(header) - 2))
        for row in rows:
            print("  " + "  ".join(str(v).ljust(col_widths[i]) for i, v in enumerate(row)))
    cur.close()
    return rows

def main():
    print(f"\nDiagnosing review submission for deck: '{DECK}'")
    conn = psycopg2.connect(DATABASE_URL)

    # 1. Cards currently marked under_review in this deck
    run(conn,
        f"Cards under_review=true in '{DECK}'",
        """
        SELECT card_id, deck, note_id, card_format,
               under_review, is_buried, stability, difficulty, last_reviewed
        FROM cards
        WHERE deck = %s AND under_review = true
        ORDER BY card_id
        """,
        (DECK,))

    # 2. Active review sessions
    run(conn,
        f"In-progress review_sessions for '{DECK}'",
        """
        SELECT session_id, deck, started_at, session_status, cards_presented
        FROM review_sessions
        WHERE deck = %s AND session_status = 'in_progress'
        ORDER BY started_at DESC
        """,
        (DECK,))

    # 3. Pending session_card_reviews — also show the card's actual deck to catch mismatches
    run(conn,
        f"Pending session_card_reviews for '{DECK}' (with actual card deck)",
        """
        SELECT scr.session_id, scr.card_id,
               scr.deck   AS scr_deck,
               c.deck     AS card_deck,
               scr.position, scr.under_review,
               CASE WHEN scr.deck != c.deck THEN '*** MISMATCH ***' ELSE 'ok' END AS deck_match
        FROM session_card_reviews scr
        JOIN cards c ON scr.card_id = c.card_id
        WHERE scr.under_review = true AND scr.deck = %s
        ORDER BY scr.session_id, scr.position
        """,
        (DECK,))

    # 4. Duplicate (session_id, card_id) pairs — the most likely cause of count mismatch
    run(conn,
        f"Duplicate (session_id, card_id) in session_card_reviews for '{DECK}'",
        """
        SELECT session_id, card_id, COUNT(*) AS cnt
        FROM session_card_reviews
        WHERE deck = %s
        GROUP BY session_id, card_id
        HAVING COUNT(*) > 1
        ORDER BY session_id, card_id
        """,
        (DECK,))

    # 5. All decks with pending sessions — to see if anything looks off globally
    run(conn,
        "All decks with pending session_card_reviews (under_review=true)",
        """
        SELECT deck, session_id, COUNT(*) AS pending_cards
        FROM session_card_reviews
        WHERE under_review = true
        GROUP BY deck, session_id
        ORDER BY deck, session_id
        """)

    # 6. Cross-check: card IDs in pending scr rows that DON'T match the deck filter
    #    (These would be invisible to the submit query and cause a count mismatch)
    run(conn,
        f"Cards in pending '{DECK}' session rows but stored under a DIFFERENT deck",
        """
        SELECT scr.session_id, scr.card_id,
               scr.deck AS session_deck, c.deck AS actual_deck
        FROM session_card_reviews scr
        JOIN cards c ON scr.card_id = c.card_id
        WHERE scr.under_review = true
          AND scr.deck = %s
          AND c.deck != %s
        """,
        (DECK, DECK))

    # 7. Actual columns in the cards table — check for reviewed_today and other expected columns
    run(conn,
        "Columns in the 'cards' table",
        """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'cards'
        ORDER BY ordinal_position
        """)

    # 8. Columns in session_card_reviews
    run(conn,
        "Columns in 'session_card_reviews' table",
        """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'session_card_reviews'
        ORDER BY ordinal_position
        """)

    # 9. Which decks have ever had a completed session? (shows which submits work)
    run(conn,
        "Completed sessions by deck (decks where submit has worked)",
        """
        SELECT deck,
               COUNT(*) AS completed_sessions,
               MAX(completed_at) AS last_completed
        FROM review_sessions
        WHERE session_status = 'completed'
        GROUP BY deck
        ORDER BY last_completed DESC
        """)

    # 10. Summary of all session statuses per deck
    run(conn,
        "Session status summary per deck",
        """
        SELECT deck, session_status, COUNT(*) AS count
        FROM review_sessions
        GROUP BY deck, session_status
        ORDER BY deck, session_status
        """)

    conn.close()
    print("\nDone.")

if __name__ == '__main__':
    main()
