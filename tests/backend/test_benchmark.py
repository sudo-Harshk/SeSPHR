from __future__ import annotations

import math

import requests


def _pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    denx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    deny = math.sqrt(sum((y - my) ** 2 for y in ys))
    if denx == 0 or deny == 0:
        return 0.0
    return num / (denx * deny)


def test_benchmark_srs_near_constant(admin_session: requests.Session, api_base: str) -> None:
    r = admin_session.post(f"{api_base}/api/admin/benchmark?mode=rsa-pre")
    assert r.status_code == 200
    j = r.json()
    assert j["success"], j
    rows = j["data"]["results"]
    assert len(rows) >= 5
    times = [
        float(row["srs_time_ms"])
        if "srs_time_ms" in row
        else float(row["srs_time"]) * 1000.0
        for row in rows
    ]
    sizes = [float(row["file_size_kb"]) for row in rows]

    # O(1) SRS: time must not track file size (|Pearson| low). Timer granularity can yield 0 ms
    # on some rows on Windows, so we also require a tight max/min ratio on measured (positive) samples.
    pos = [t for t in times if t > 0.5]
    assert len(pos) >= 3, f"expected >=3 positive SRS samples, got {times}"

    r_size_time = abs(_pearson(sizes, times))
    assert r_size_time < 0.75, f"SRS time correlates with file size too strongly: r={r_size_time:.3f}"

    ratio = max(pos) / min(pos)
    assert ratio < 3.0, f"SRS max/min too large for O(1) key op: ratio={ratio:.3f} pos={pos}"

    # Secondary: coefficient of variation on positive samples (RSA jitter on Windows often exceeds 10%).
    if len(pos) >= 5:
        mean = sum(pos) / len(pos)
        var = sum((x - mean) ** 2 for x in pos) / (len(pos) - 1)
        cv = math.sqrt(var) / mean if mean else 0.0
        assert cv < 0.35, f"SRS CV too high: {cv:.4f} pos={pos}"
