"""Benchmark: enumerate ALL complete solutions for one or more dates.

Each "complete solution" = one full placement of all 10 blocks on the board,
leaving exactly the month/day/weekday markers uncovered. The current puzzle
generator only uses the FIRST solution; this script measures the full set.
"""
import datetime
import time
from calendar_puzzle.dancing_link.calendar import FasterGame


def count_all_for_date(dt: datetime.date) -> tuple[int, float, float]:
    """Return (n_solutions, build_seconds, search_seconds)."""
    t0 = time.perf_counter()
    g = FasterGame(dt)
    t1 = time.perf_counter()
    n = 0
    for _ in g.dlx.search():
        n += 1
    t2 = time.perf_counter()
    return n, t1 - t0, t2 - t1


def main():
    # Sample a spread of dates across the year so weekday/month variation is covered.
    dates = [
        datetime.date(2026, 1, 1),
        datetime.date(2026, 2, 14),
        datetime.date(2026, 5, 14),
        datetime.date(2026, 5, 17),
        datetime.date(2026, 7, 4),
        datetime.date(2026, 10, 31),
        datetime.date(2026, 12, 25),
    ]

    print(f"{'date':12} {'weekday':4} {'#solutions':>11} {'build(s)':>10} {'search(s)':>10} {'total(s)':>10}")
    print("-" * 65)
    totals = []
    for dt in dates:
        n, tb, ts = count_all_for_date(dt)
        totals.append((dt, n, tb, ts))
        print(f"{dt!s:12} {dt.strftime('%a'):4} {n:>11d} {tb:>10.3f} {ts:>10.3f} {tb+ts:>10.3f}")

    print("-" * 65)
    ns = [t[1] for t in totals]
    bs = [t[2] for t in totals]
    ss = [t[3] for t in totals]
    print(f"min={min(ns)} max={max(ns)} avg={sum(ns)/len(ns):.0f} solutions/day")
    print(f"build avg={sum(bs)/len(bs):.3f}s  search avg={sum(ss)/len(ss):.3f}s")


if __name__ == "__main__":
    main()
