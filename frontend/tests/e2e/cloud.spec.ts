import { test, expect } from "@playwright/test"
import { readSeedInfo, storageStateFiles } from "./utils"

test.use({ storageState: storageStateFiles.admin })

test.describe("admin cloud view", () => {
  test("ciphertext + metadata only; expanded panel labels", async ({ page }) => {
    const { encFilename } = readSeedInfo()

    await page.goto("/admin/cloud")
    await expect(page.locator("body")).toContainText(".enc")

    const mainText = (await page.locator("body").innerText()).toLowerCase()
    expect(mainText).not.toContain("patient1@demo.com")
    expect(mainText).not.toMatch(/\bphone\b/)
    expect(mainText).not.toMatch(/\bage\b/)

    await page.getByTestId(`cloud-inspect-${encFilename}`).click()
    await expect(page.getByTestId("cloud-meta-key-blob")).toContainText("Encrypted AES key")
    await expect(page.getByTestId("cloud-meta-iv")).toContainText("Initialization vector")
  })
})
