import { test, expect } from "@playwright/test"
import { coefficientOfVariation, storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.admin })

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const vx = xs[i]! - mx
    const vy = ys[i]! - my
    num += vx * vy
    dx += vx * vx
    dy += vy * vy
  }
  if (dx === 0 || dy === 0) return 0
  return num / Math.sqrt(dx * dy)
}

test.describe("benchmarks", () => {
  test("UI O(1)/O(n) and backend SRS near-constant", async ({ page }) => {
    await page.goto("/admin/benchmark")
    await page.getByTestId("benchmark-run").click()
    await expect(page.getByTestId("benchmark-bar-chart")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("benchmark-o1")).toContainText("O(1)")
    await expect(page.getByTestId("benchmark-on")).toContainText("O(n)")

    const apiJson = await page.evaluate(async () => {
      const res = await fetch("/api/admin/benchmark?mode=rsa-pre", {
        method: "POST",
        credentials: "include",
      })
      return res.json()
    })

    expect(apiJson.success).toBeTruthy()
    const rows = apiJson.data?.results ?? []
    expect(rows.length).toBeGreaterThanOrEqual(5)

    const times: number[] = rows.map(
      (r: { srs_time_ms?: number; srs_time?: number }) =>
        typeof r.srs_time_ms === "number" ? r.srs_time_ms : (r.srs_time as number) * 1000
    )
    const sizes: number[] = rows.map((r: { file_size_kb: number }) => r.file_size_kb)

    const pos = times.filter((t) => t > 0.5)
    expect(pos.length).toBeGreaterThanOrEqual(3)

    expect(Math.abs(pearson(sizes, times))).toBeLessThan(0.75)

    const ratio = Math.max(...pos) / Math.min(...pos)
    expect(ratio).toBeLessThan(3.0)

    if (pos.length >= 5) {
      const cv = coefficientOfVariation(pos)
      expect(cv, `SRS CV=${cv.toFixed(4)} pos=${JSON.stringify(pos)}`).toBeLessThan(0.35)
    }
  })
})
