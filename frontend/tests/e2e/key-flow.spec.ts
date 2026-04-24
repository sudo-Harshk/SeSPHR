import { test, expect } from "@playwright/test"
import { E2E_SEED_BASENAME, storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.doctor })

test.describe("key flow", () => {
  test("file size unchanged; key-only claim", async ({ page }) => {
    await page.goto("/doctor/files")
    await page.getByTestId(`request-access-${E2E_SEED_BASENAME}`).click({ timeout: 60_000 })
    await expect(page.getByTestId("key-flow-file-size-values")).toBeVisible({ timeout: 120_000 })

    const sizeText = (await page.getByTestId("key-flow-file-size-values").innerText()).replace(/\s/g, "")
    expect(sizeText).toMatch(/→/)
    const parts = sizeText.split("→")
    expect(parts.length).toBe(2)
    expect(parts[0]).toEqual(parts[1])

    await expect(page.getByTestId("key-flow-claim")).toContainText("Only 32-byte AES key changes")
  })
})
