"""
Find and fix cards with corrupted interval / time_due values across all decks.
A card is considered corrupt if interval > 36500 days (100 years).
The fix resets interval to round(stability) and recomputes time_due as
last_reviewed + interval days (falling back to now if last_reviewed is NULL).

Run dry-run first (default), then pass --apply to commit.
  py -3.12 python/fix_corrupt_intervals.py
  py -3.12 python/fix_corrupt_intervals.py --apply
"""

import sys
import os
import math
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone, timedelta

DATABASE_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://postgres:Cb4-D5B2BEEg6*GBBB*Fga*b5FE6CbfF@monorail.proxy.rlwy.net:14224/railway'
)

APPLY = '--apply' in sys.argv
MAX_INTERVAL = 36500  # 100 years — anything over this is corrupt


def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Find all corrupt cards (use text cast to avoid Python overflow on the interval value)
    cur.execute("""
        SELECT card_id, deck, note_id, card_format,
               interval,
               stability,
               last_reviewed,
               time_due::text AS time_due_raw
        FROM cards
        WHERE interval > %s
        ORDER BY deck, card_id
    """, (MAX_INTERVAL,))
    corrupt = cur.fetchall()

    if not corrupt:
        print("No corrupt cards found (interval > 36500). Nothing to do.")
        conn.close()
        return

    print(f"Found {len(corrupt)} corrupt card(s):\n")
    now = datetime.now(timezone.utc)

    fixes = []
    for row in corrupt:
        stability = row['stability']
        last_reviewed = row['last_reviewed']

        # Correct interval: use stability, capped to MAX_INTERVAL
        if stability and not math.isnan(stability) and stability > 0:
            correct_interval = min(MAX_INTERVAL, max(1, math.ceil(stability)))
        else:
            correct_interval = 1

        # Correct time_due: last_reviewed + interval days (or now + interval if no last_reviewed)
        base = last_reviewed if last_reviewed else now
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        correct_due = base + timedelta(days=correct_interval)

        fixes.append({
            'card_id': row['card_id'],
            'deck': row['deck'],
            'old_interval': row['interval'],
            'old_time_due': row['time_due_raw'],
            'stability': stability,
            'new_interval': correct_interval,
            'new_time_due': correct_due,
        })

        print(f"  card {row['card_id']} ({row['deck']}, {row['card_format']})")
        print(f"    interval:  {row['interval']} → {correct_interval} days")
        print(f"    time_due:  {row['time_due_raw']} → {correct_due.date()}")
        print(f"    stability: {stability}")
        print()

    if not APPLY:
        print("DRY RUN — no changes made. Pass --apply to commit fixes.")
        conn.close()
        return

    print(f"Applying {len(fixes)} fix(es)...")
    for fix in fixes:
        cur.execute("""
            UPDATE cards
            SET interval = %s,
                time_due = %s
            WHERE card_id = %s
        """, (fix['new_interval'], fix['new_time_due'], fix['card_id']))
        print(f"  ✅ Fixed card {fix['card_id']} ({fix['deck']})")

    conn.commit()
    print(f"\nDone. {len(fixes)} card(s) corrected.")
    conn.close()


if __name__ == '__main__':
    main()
