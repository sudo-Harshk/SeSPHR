import { test, expect } from "@playwright/test"
import { storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.admin })

test.describe("admin dashboard", () => {
  test("threat model and architecture", async ({ page }) => {
    await page.goto("/admin")
    await expect(page.getByTestId("dashboard-threat-srs")).toContainText("Malicious SRS")
    await expect(page.getByTestId("dashboard-threat-srs")).toContainText("Not protected")
    await expect(page.getByTestId("dashboard-arch-decryption-browser")).toContainText(
      "Decryption happens only in browser"
    )
  })
})
