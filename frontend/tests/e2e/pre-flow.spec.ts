import { test, expect } from "@playwright/test"
import { E2E_SEED_BASENAME, storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.doctor })

test.describe("PRE flow", () => {
  test("key before/after differ; step timings visible", async ({ page }) => {
    await page.goto("/doctor/files")
    await page.getByTestId(`request-access-${E2E_SEED_BASENAME}`).click({ timeout: 60_000 })

    await expect(page.getByTestId("key-before")).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId("key-after")).toBeVisible()

    const before = (await page.getByTestId("key-before").textContent())?.trim() ?? ""
    const after = (await page.getByTestId("key-after").textContent())?.trim() ?? ""
    expect(before.length).toBeGreaterThan(0)
    expect(after.length).toBeGreaterThan(0)
    expect(before).not.toEqual(after)

    await expect(page.getByTestId("pre-step-timings")).toBeVisible()
    const timingRowCount = await page.getByTestId("pre-step-timings").locator("> div").count()
    expect(timingRowCount).toBeGreaterThanOrEqual(3)
  })
})
