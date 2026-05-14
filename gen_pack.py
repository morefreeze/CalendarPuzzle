"""Generate a solution pack indexed by (month, day, weekday).

Free tier  : --top-k N  caps solutions per key (small main-bundle pack).
Paid tier  : --all       full enumeration per key (cloud-served).

Output is one JSON file (and a gzipped copy) keyed by "M-D-W" strings,
each value a list of 56-char board strings (8 rows × 7 cols, '#'/'*' kept).

Examples
--------
    # quick smoke test on 25 keys with a cap
    python gen_pack.py --top-k 20 --limit 25 --out pack_data/sample.json

    # full free pack
    python gen_pack.py --top-k 20 --parallel 8 --out pack_data/pack_free.json

    # full paid pack (long-running; consider --parallel and overnight)
    python gen_pack.py --all --parallel 8 --out pack_data/pack_full.json
"""
import argparse
import datetime
import gzip
import json
import multiprocessing as mp
import os
import time

from calendar_puzzle.dancing_link.calendar import FasterGame


WINDOW_DAYS = 28 * 366  # covers every (m, d, weekday) tuple at least once.


def enumerate_keys_with_dates():
    """Return list of ((m, d, weekday), example_date) sorted by key."""
    seen = {}
    start = datetime.date(2024, 1, 1)
    for offset in range(WINDOW_DAYS):
        d = start + datetime.timedelta(days=offset)
        k = (d.month, d.day, d.weekday())
        if k not in seen:
            seen[k] = d
    return sorted(seen.items())


def encode_solution(sol_steps, row_names):
    b = []
    for step in sol_steps:
        rn = row_names[step.coordinate[0]]
        if not b:
            b = list(rn)
        else:
            for i, c in enumerate(rn):
                if b[i] == ' ' and c != ' ':
                    b[i] = c
    return ''.join(b).replace('\n', '')


def solve_one(args):
    key, dt_iso, top_k = args
    dt = datetime.date.fromisoformat(dt_iso)
    g = FasterGame(dt)
    sols = []
    for steps in g.dlx.search():
        sols.append(encode_solution(steps, g.dlx.row_names))
        if top_k is not None and len(sols) >= top_k:
            break
    return key, sols


def key_str(k):
    return f"{k[0]}-{k[1]}-{k[2]}"


def main():
    p = argparse.ArgumentParser()
    grp = p.add_mutually_exclusive_group(required=True)
    grp.add_argument('--top-k', type=int, help='Cap solutions per key.')
    grp.add_argument('--all', action='store_true', help='Enumerate all solutions per key.')
    p.add_argument('--out', required=True, help='Output JSON path; .gz is emitted alongside.')
    p.add_argument('--parallel', type=int, default=1, help='Worker processes (default 1).')
    p.add_argument('--limit', type=int, default=None, help='Stop after N keys (for testing).')
    p.add_argument('--progress-every', type=int, default=25, help='Progress log cadence.')
    args = p.parse_args()

    top_k = None if args.all else args.top_k
    keys_dates = enumerate_keys_with_dates()
    if args.limit:
        keys_dates = keys_dates[:args.limit]
    n = len(keys_dates)
    print(f"Keys: {n}; mode={'ALL' if top_k is None else f'top-{top_k}'}; parallel={args.parallel}")

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    work = [(k, dt.isoformat(), top_k) for (k, dt) in keys_dates]

    pack = {}
    t0 = time.perf_counter()

    def log_progress(done):
        elapsed = time.perf_counter() - t0
        rate = done / elapsed if elapsed > 0 else 0
        eta = (n - done) / rate if rate > 0 else float('inf')
        print(f"  [{done}/{n}] elapsed={elapsed:.0f}s rate={rate:.2f} keys/s ETA={eta:.0f}s")

    if args.parallel > 1:
        with mp.Pool(args.parallel) as pool:
            for i, (key, sols) in enumerate(pool.imap_unordered(solve_one, work, chunksize=1), 1):
                pack[key_str(key)] = sols
                if i % args.progress_every == 0 or i == n:
                    log_progress(i)
    else:
        for i, w in enumerate(work, 1):
            key, sols = solve_one(w)
            pack[key_str(key)] = sols
            if i % args.progress_every == 0 or i == n:
                log_progress(i)

    payload = json.dumps(pack, separators=(',', ':'), sort_keys=True)
    raw_path = args.out
    gz_path = args.out + '.gz'
    with open(raw_path, 'w') as f:
        f.write(payload)
    raw_bytes = os.path.getsize(raw_path)
    with gzip.open(gz_path, 'wb', compresslevel=9) as f:
        f.write(payload.encode('utf-8'))
    gz_bytes = os.path.getsize(gz_path)

    total = time.perf_counter() - t0
    total_sols = sum(len(v) for v in pack.values())
    counts = sorted(len(v) for v in pack.values())
    print()
    print(f"Done in {total:.1f}s ({total/60:.2f} min)")
    print(f"Keys written : {len(pack)}")
    print(f"Solutions    : total={total_sols}  min={counts[0]}  median={counts[len(counts)//2]}  max={counts[-1]}  avg={total_sols/len(pack):.1f}")
    print(f"Raw  size    : {raw_bytes:>12,} B = {raw_bytes/1024/1024:.2f} MB")
    print(f"Gzip size    : {gz_bytes:>12,} B = {gz_bytes/1024/1024:.2f} MB")
    print(f"Outputs      : {raw_path}, {gz_path}")


if __name__ == '__main__':
    main()
