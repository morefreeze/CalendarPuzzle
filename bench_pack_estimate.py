"""Estimate pack size + total CPU time for a (month, day, weekday) indexed
solution pack capped at TOP_K solutions per key.

Strategy:
  1. Enumerate all valid (month, day, weekday) keys by walking a 28-year window.
  2. Sample SAMPLE_N keys uniformly across that set.
  3. For each sample, measure the time to find the first TOP_K solutions and
     the on-disk JSON size of those solutions (cells as a single string).
  4. Extrapolate to all keys.
"""
import datetime
import json
import random
import time

from calendar_puzzle.dancing_link.calendar import FasterGame


TOP_K = 50          # how many solutions to keep per key in the pack
SAMPLE_N = 25       # how many keys to time in this benchmark

random.seed(42)


def enumerate_valid_keys() -> list[tuple[int, int, int]]:
    """All (month, day, weekday) tuples that occur in a 28-year Gregorian cycle.
    weekday: 0=Mon..6=Sun (datetime.date.weekday)."""
    keys: set[tuple[int, int, int]] = set()
    start = datetime.date(2024, 1, 1)
    for offset in range(28 * 366):
        d = start + datetime.timedelta(days=offset)
        keys.add((d.month, d.day, d.weekday()))
    return sorted(keys)


def example_date_for(m: int, d: int, wd: int) -> datetime.date | None:
    """Return the first date >= 2024-01-01 that has these (m, d, weekday)."""
    start = datetime.date(2024, 1, 1)
    for offset in range(28 * 366):
        cand = start + datetime.timedelta(days=offset)
        if cand.month == m and cand.day == d and cand.weekday() == wd:
            return cand
    return None


def time_top_k(dt: datetime.date, k: int) -> tuple[int, float, list[str]]:
    """Build DLX, take first k solutions, return (got, search_seconds, solutions).
    Each solution is encoded as a flat 56-char string (8 rows × 7 cols)."""
    g = FasterGame(dt)
    t0 = time.perf_counter()
    got = 0
    sols: list[str] = []
    for sol_steps in g.dlx.search():
        # Reconstruct the 8×7 board from the DLX solution rows.
        b_str: list[str] = []
        for step in sol_steps:
            row_str = g.dlx.row_names[step.coordinate[0]]
            if not b_str:
                b_str = list(row_str)
            else:
                for i, c in enumerate(row_str):
                    if b_str[i] == ' ' and c != ' ':
                        b_str[i] = c
        # Strip the embedded newlines (row separators) so we get a 56-char string.
        sols.append(''.join(b_str).replace('\n', ''))
        got += 1
        if got >= k:
            break
    t1 = time.perf_counter()
    return got, t1 - t0, sols


def main():
    print("Enumerating valid (month, day, weekday) keys ...")
    keys = enumerate_valid_keys()
    print(f"  total unique keys: {len(keys)}")

    sample = random.sample(keys, SAMPLE_N)
    sample.sort()

    times = []
    json_bytes = []
    sol_counts = []

    print(f"\nTiming TOP_K={TOP_K} solutions for {SAMPLE_N} sampled keys ...\n")
    print(f"{'(m,d,wd)':12} {'date':12} {'got':>4} {'time(s)':>9} {'json(B)':>9}")
    print("-" * 50)
    for (m, d, wd) in sample:
        dt = example_date_for(m, d, wd)
        if dt is None:
            print(f"  skip ({m},{d},{wd}) — no date found")
            continue
        got, ts, sols = time_top_k(dt, TOP_K)
        payload = json.dumps(sols, separators=(',', ':'))
        nb = len(payload.encode('utf-8'))
        times.append(ts)
        json_bytes.append(nb)
        sol_counts.append(got)
        print(f"({m:2d},{d:2d},{wd}) {dt!s:12} {got:>4d} {ts:>9.3f} {nb:>9d}")

    print("-" * 50)
    avg_t = sum(times) / len(times)
    avg_b = sum(json_bytes) / len(json_bytes)
    n_keys = len(keys)
    print(f"per-key  avg_time={avg_t:.3f}s   avg_json={avg_b:.0f} B   "
          f"min_sols={min(sol_counts)} avg_sols={sum(sol_counts)/len(sol_counts):.1f}")
    print()
    print(f"Extrapolating to all {n_keys} keys at TOP_K={TOP_K}:")
    print(f"  total CPU time : ~{avg_t * n_keys:.0f}s "
          f"(~{avg_t * n_keys / 60:.1f} min ~= {avg_t * n_keys / 3600:.2f} h)")
    print(f"  total JSON size: ~{avg_b * n_keys / 1024:.0f} KB uncompressed "
          f"(~{avg_b * n_keys / 1024 / 1024:.2f} MB)")
    print(f"  gzip estimate  : ~{avg_b * n_keys / 1024 * 0.25:.0f} KB (assuming ~4x ratio)")


if __name__ == "__main__":
    main()
