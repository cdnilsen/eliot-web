"""
Simulate the submit_review_results transaction for the active Akkadian session
to find exactly where it throws. Runs inside a transaction that is always
rolled back at the end — safe to run without modifying anything.

Run with: py -3.12 python/simulate_submit.py [deck] [session_id]
Defaults: Akkadian, latest in-progress session that has pending rows.
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

DECK = sys.argv[1] if len(sys.argv) > 1 else 'Akkadian'
SESSION_ID = int(sys.argv[2]) if len(sys.argv) > 2 else None

# ── FSRS constants (same as scheduler.ts) ─────────────────────────────────
W = [0.40255,1.18385,3.173,15.69105,7.1949,0.5345,1.4604,0.0046,1.54575,
     0.1192,1.01925,1.9395,0.11,0.29605,2.2698,0.2315,2.9898,0.51655,0.6621]
RETENTION = 0.9
MAX_INTERVAL_DAYS = 36500

def clamp(v, lo, hi): return max(lo, min(hi, v))
def clamp_d(d): return clamp(d, 1, 10)

def get_initial_stability(g): return W[g - 1]
def get_initial_difficulty(g): return clamp_d(W[4] - math.exp(W[5] * (g - 1)) + 1)

def recalc_retrievability(last_review, reviewed_at, stability):
    diff_days = (reviewed_at - last_review).total_seconds() / 86400
    diff_days = max(0, diff_days)
    F, C = 19/81, -0.5
    return (1 + F * diff_days / stability) ** C

def stability_on_success(S, D, R, g):
    t_d = 11 - D
    t_s = S ** (-W[9])
    t_r = math.exp(W[10] * (1 - R)) - 1
    H = W[15] if g == 2 else 1
    B = W[16] if g == 4 else 1
    e_w8 = math.exp(W[8])
    return S * (1 + t_d * t_s * t_r * H * B * e_w8)

def stability_on_failure(S, D, R):
    return min(S, D**(-W[12]) * ((S+1)**W[13] - 1) * math.exp(W[14]*(1-R)) * W[11])

def review_difficulty(D, g):
    delta = (0 - W[6]) * (g - 3)
    d_prime = D + delta * ((10 - D) / 9)
    return clamp_d(W[7] * get_initial_difficulty(4) + (1 - W[7]) * d_prime)

def update_interval(stability):
    F, C = 19/81, -0.5
    ms = stability * ((RETENTION ** (1/C)) - 1) / F * 86400000
    days = math.ceil(ms / 86400000)
    return max(1, min(MAX_INTERVAL_DAYS, days))

def grade_to_rating(grade):
    return {'pass': 3, 'hard': 2, 'fail': 1}.get(grade.lower(), 1)

def schedule_card(card, grade, reviewed_at):
    rating = grade_to_rating(grade)
    is_first = card['stability'] is None
    if is_first:
        stability  = get_initial_stability(rating)
        difficulty = get_initial_difficulty(rating)
        retrievability = 1.0
    else:
        last_review = card['last_reviewed']
        if last_review:
            if hasattr(last_review, 'tzinfo') and last_review.tzinfo is None:
                last_review = last_review.replace(tzinfo=timezone.utc)
            retrievability = recalc_retrievability(last_review, reviewed_at, card['stability'])
        else:
            retrievability = 0.9
        retrievability = max(0.01, retrievability) if not math.isnan(retrievability) else 0.01
        old_S, old_D = card['stability'], (card['difficulty'] or 5)
        stability  = stability_on_success(old_S, old_D, retrievability, rating) if rating > 1 \
                     else stability_on_failure(old_S, old_D, retrievability)
        difficulty = review_difficulty(old_D, rating)
    if math.isnan(stability) or stability <= 0: stability = W[2]
    if math.isnan(difficulty): difficulty = 5
    stability = min(stability, MAX_INTERVAL_DAYS)
    new_interval = update_interval(stability)
    new_due = reviewed_at + timedelta(days=new_interval)
    return {'new_interval': new_interval, 'new_stability': stability,
            'new_difficulty': difficulty, 'new_retrievability': 1.0, 'new_due': new_due}

# ── Main ───────────────────────────────────────────────────────────────────

def step(label):
    print(f"\n  ▶ {label} ...", end=' ', flush=True)

def ok(msg=''):
    print(f"OK {msg}")

def fail(e):
    print(f"\n  ✗ FAILED: {e}")
    raise

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    psycopg2.extras.register_default_jsonb(conn)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print(f"\nSimulating submit for deck='{DECK}'")

    # Find session to test
    if SESSION_ID:
        session_id = SESSION_ID
    else:
        cur.execute("""
            SELECT scr.session_id
            FROM session_card_reviews scr
            WHERE scr.deck = %s AND scr.under_review = true
            GROUP BY scr.session_id
            ORDER BY scr.session_id DESC
            LIMIT 1
        """, (DECK,))
        row = cur.fetchone()
        if not row:
            print(f"No active session found for '{DECK}'. Nothing to test.")
            return
        session_id = row['session_id']

    print(f"  Using session_id={session_id}")

    reviewed_at = datetime.now(timezone.utc)

    try:
        # ── Step 1: get results from session_card_reviews ────────────────
        step("Fetch card IDs from session_card_reviews")
        cur.execute("""
            SELECT card_id FROM session_card_reviews
            WHERE session_id = %s AND deck = %s AND under_review = true
        """, (session_id, DECK))
        scr_rows = cur.fetchall()
        card_ids = [r['card_id'] for r in scr_rows]
        ok(f"({len(card_ids)} cards: {card_ids})")

        # Simulate all grades as 'pass'
        results = [{'cardId': cid, 'result': 'pass'} for cid in card_ids]

        # ── Step 2: BEGIN ─────────────────────────────────────────────────
        step("BEGIN")
        cur.execute("BEGIN")
        ok()

        # ── Step 3: fetch current card data ───────────────────────────────
        step("SELECT current card data")
        cur.execute("""
            SELECT card_id, time_due, interval, retrievability, stability,
                   difficulty, deck, last_reviewed
            FROM cards
            WHERE deck = %s AND card_id = ANY(%s)
        """, (DECK, card_ids))
        db_cards = {r['card_id']: r for r in cur.fetchall()}
        ok(f"({len(db_cards)} rows returned)")

        # ── Step 4: count check ───────────────────────────────────────────
        step("Count check")
        if len(db_cards) != len(results):
            raise ValueError(f"Expected {len(results)} cards, found {len(db_cards)}")
        ok()

        # ── Step 5: FSRS scheduling ───────────────────────────────────────
        step("FSRS scheduling")
        scheduled = {}
        for r in results:
            cid = r['cardId']
            card = db_cards[cid]
            sched = schedule_card(card, r['result'], reviewed_at)
            scheduled[cid] = sched
            print(f"\n      card {cid}: interval {card['interval']} → {sched['new_interval']}d"
                  f"  stability {card['stability']:.2f} → {sched['new_stability']:.2f}", end='')
        ok()

        # ── Step 6: UPDATE cards (FSRS results) ───────────────────────────
        step("UPDATE cards (FSRS + under_review=false + reviewed_today=true)")
        for cid, sched in scheduled.items():
            cur.execute("""
                UPDATE cards
                SET time_due      = %s,
                    interval      = %s,
                    retrievability = %s,
                    stability     = %s,
                    difficulty    = %s,
                    under_review  = false,
                    last_reviewed = %s,
                    reviewed_today = true
                WHERE card_id = %s
            """, (sched['new_due'], sched['new_interval'], sched['new_retrievability'],
                  sched['new_stability'], sched['new_difficulty'], reviewed_at, cid))
        ok()

        # ── Step 7: peer boost ─────────────────────────────────────────────
        step("Peer boost (passed cards)")
        passed_ids = [r['cardId'] for r in results if r['result'] == 'pass']
        if passed_ids:
            cur.execute("""
                SELECT card_id, note_id, peers FROM cards WHERE card_id = ANY(%s)
            """, (passed_ids,))
            passed_info = cur.fetchall()
            reviewed_set = set(card_ids)
            candidate_pairs = []
            for row in passed_info:
                if row['peers']:
                    for peer_id in row['peers']:
                        if peer_id not in reviewed_set:
                            candidate_pairs.append({'peer_id': peer_id, 'note_id': row['note_id']})
            unique_peer_ids = list({p['peer_id'] for p in candidate_pairs})
            if unique_peer_ids:
                cur.execute("""
                    SELECT card_id, note_id, interval, time_due FROM cards WHERE card_id = ANY(%s)
                """, (unique_peer_ids,))
                peer_map = {r['card_id']: r for r in cur.fetchall()}
                to_boost = set()
                for cp in candidate_pairs:
                    pi = peer_map.get(cp['peer_id'])
                    if pi and pi['note_id'] == cp['note_id']:
                        to_boost.add(cp['peer_id'])
                for peer_id in to_boost:
                    peer = peer_map[peer_id]
                    interval = peer['interval'] or 1
                    boost = max(math.floor(interval * 0.05), 1)
                    new_interval = interval + boost
                    new_due = datetime.fromisoformat(str(peer['time_due'])) + timedelta(days=boost)
                    cur.execute("""
                        UPDATE cards SET interval = %s, time_due = %s WHERE card_id = %s
                    """, (new_interval, new_due, peer['card_id']))
                ok(f"(boosted {len(to_boost)} peer cards)")
            else:
                ok("(no peers outside reviewed set)")
        else:
            ok("(no passed cards)")

        # ── Step 8: bury reviewed cards ────────────────────────────────────
        step("Bury reviewed cards (is_buried=true)")
        cur.execute("""
            UPDATE cards SET is_buried = true, is_only_buried_today = true
            WHERE card_id = ANY(%s)
        """, (card_ids,))
        ok()

        # ── Step 9: UPDATE review_sessions ────────────────────────────────
        step("UPDATE review_sessions → completed")
        cur.execute("""
            UPDATE review_sessions
            SET completed_at = %s, cards_completed = %s,
                pass_count = %s, hard_count = %s, fail_count = %s,
                session_status = 'completed'
            WHERE session_id = %s
        """, (reviewed_at, len(results),
              sum(1 for r in results if r['result']=='pass'),
              sum(1 for r in results if r['result']=='hard'),
              sum(1 for r in results if r['result']=='fail'),
              session_id))
        ok()

        # ── Step 10: UPDATE session_card_reviews ──────────────────────────
        step("UPDATE session_card_reviews (under_review=false)")
        for r in results:
            sched = scheduled[r['cardId']]
            cur.execute("""
                UPDATE session_card_reviews
                SET reviewed_at       = %s,
                    grade             = %s,
                    interval_after    = %s,
                    retrievability_after = %s,
                    under_review      = false
                WHERE session_id = %s AND card_id = %s AND deck = %s
            """, (reviewed_at, r['result'],
                  sched['new_interval'], sched['new_retrievability'],
                  session_id, r['cardId'], DECK))
        ok()

        print("\n\n  ✅ ALL STEPS PASSED — transaction would succeed.")
        print("  (Rolling back so no data is changed.)")

    except Exception as e:
        print(f"\n\n  ❌ EXCEPTION: {type(e).__name__}: {e}")
    finally:
        cur.execute("ROLLBACK")
        conn.close()

def find_corrupt_peers():
    """Find peer cards with extreme time_due/interval that break the peer boost."""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print(f"\n{'='*60}")
    print(f"  Peer cards of active '{DECK}' session with extreme values")
    print('='*60)

    # Get the reviewed card IDs from the active session
    cur.execute("""
        SELECT card_id FROM session_card_reviews
        WHERE deck = %s AND under_review = true
    """, (DECK,))
    reviewed_ids = [r['card_id'] for r in cur.fetchall()]

    if not reviewed_ids:
        print("  No active session found.")
        conn.close()
        return

    # Get the peers of those cards
    cur.execute("""
        SELECT card_id, peers FROM cards WHERE card_id = ANY(%s)
    """, (reviewed_ids,))
    peer_ids = set()
    for row in cur.fetchall():
        if row['peers']:
            for pid in row['peers']:
                if pid not in reviewed_ids:
                    peer_ids.add(pid)

    if not peer_ids:
        print("  No peers outside reviewed set.")
        conn.close()
        return

    # Show all peer cards' time_due and interval as raw text to avoid Python datetime overflow
    cur.execute("""
        SELECT card_id, deck, note_id, interval,
               time_due::text AS time_due_raw,
               stability, last_reviewed
        FROM cards
        WHERE card_id = ANY(%s)
        ORDER BY interval DESC NULLS LAST
    """, (list(peer_ids),))
    rows = cur.fetchall()

    extreme = [r for r in rows if r['interval'] and r['interval'] > 36500]
    normal  = [r for r in rows if not r['interval'] or r['interval'] <= 36500]

    if extreme:
        print(f"\n  ⚠  {len(extreme)} EXTREME interval peer(s):")
        for r in extreme:
            print(f"     card_id={r['card_id']}  deck={r['deck']}  interval={r['interval']} days"
                  f"  time_due={r['time_due_raw']}  stability={r['stability']}")
    else:
        print("  No extreme-interval peers found.")

    if normal:
        print(f"\n  Normal peer(s) ({len(normal)}):")
        for r in normal:
            print(f"     card_id={r['card_id']}  interval={r['interval']} days"
                  f"  time_due={r['time_due_raw']}")

    conn.close()

if __name__ == '__main__':
    find_corrupt_peers()
    main()
