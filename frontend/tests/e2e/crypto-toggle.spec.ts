import { test, expect } from "@playwright/test"
import { storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.admin })

test.describe("CP-ABE simulation", () => {
  test("shows not real CP-ABE", async ({ page }) => {
    await page.goto("/admin/benchmark")
    await page.getByTestId("benchmark-mode-cpabe").click()
    await expect(page.getByTestId("cpabe-simulation-warning")).toContainText("NOT real CP-ABE")
  })
})
