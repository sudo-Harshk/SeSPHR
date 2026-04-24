import { test, expect } from "@playwright/test"
import { storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.admin })

test.describe("audit log", () => {
  test("active then tamper detected", async ({ page }) => {
    await page.goto("/admin/audit")
    await expect(page.getByTestId("audit-status")).toContainText("TAMPER DETECTION ACTIVE", {
      timeout: 30_000,
    })

    const tamperResult = await page.evaluate(async () => {
      const res = await fetch("/api/debug/tamper-audit-log", {
        method: "POST",
        credentials: "include",
      })
      const body = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, body }
    })
    expect(tamperResult.ok, JSON.stringify(tamperResult.body)).toBeTruthy()

    await page.reload()
    await page.waitForTimeout(500)

    await expect(page.getByTestId("audit-status")).toContainText("TAMPER DETECTED", { timeout: 30_000 })
    await expect(page.getByTestId("audit-status")).toContainText(/block #\d+/)
  })
})
