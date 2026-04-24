import { test as setup, expect } from "@playwright/test"
import fs from "fs"
import path from "path"
import { E2E_SEED_BASENAME, authDir, seedFixturePath } from "./utils"

const AUTH_DIR = authDir()
const FIXTURE = seedFixturePath
const ENC_NAME = `${E2E_SEED_BASENAME}.enc`

setup("reset cloud + audit, seed via patient UI, doctor access, save storage states", async ({ browser }) => {
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173"
  const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:5000"

  const resetCtx = await browser.newContext()
  const resetReq = resetCtx.request
  const clearUp = await resetReq.post(`${apiURL}/api/debug/clear-uploads`)
  expect(clearUp.ok(), `clear-uploads: ${clearUp.status()}`).toBeTruthy()
  const clearAudit = await resetReq.post(`${apiURL}/api/debug/clear-audit-log`)
  expect(clearAudit.ok(), `clear-audit-log: ${clearAudit.status()}`).toBeTruthy()
  await resetCtx.close()

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(AUTH_DIR, "seed-info.json"),
    JSON.stringify({ filename: E2E_SEED_BASENAME, encFilename: ENC_NAME }, null, 2)
  )

  // Patient: real browser encrypt + upload
  const pCtx = await browser.newContext()
  const page = await pCtx.newPage()
  await page.goto(`${baseURL}/login`)
  await page.locator("#email").fill("patient1@demo.com")
  await page.locator("#password").fill("Demo@1234")
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/patient$/, { timeout: 30_000 })
  await page.goto(`${baseURL}/patient/files`)
  await page.getByTestId("patient-file-input").setInputFiles(FIXTURE)
  await page.getByTestId("patient-upload-submit").click()
  await page.getByText(/Encrypted in your browser/i).waitFor({ timeout: 120_000 })
  await pCtx.storageState({ path: path.join(AUTH_DIR, "patient.json") })
  await pCtx.close()

  // Doctor: request access (View) to populate PRE + audit
  const dCtx = await browser.newContext()
  const dPage = await dCtx.newPage()
  await dPage.goto(`${baseURL}/login`)
  await dPage.locator("#email").fill("dr_cardio@demo.com")
  await dPage.locator("#password").fill("Demo@1234")
  await dPage.locator('button[type="submit"]').click()
  await dPage.waitForURL(/\/doctor$/, { timeout: 30_000 })
  await dPage.goto(`${baseURL}/doctor/files`)
  await dPage.getByTestId(`request-access-${E2E_SEED_BASENAME}`).click({ timeout: 60_000 })
  await dPage.getByTestId("key-before").waitFor({ state: "visible", timeout: 120_000 })
  await dCtx.storageState({ path: path.join(AUTH_DIR, "doctor.json") })
  await dCtx.close()

  // Admin
  const aCtx = await browser.newContext()
  const aPage = await aCtx.newPage()
  await aPage.goto(`${baseURL}/login`)
  await aPage.locator("#email").fill("admin@demo.com")
  await aPage.locator("#password").fill("Demo@1234")
  await aPage.locator('button[type="submit"]').click()
  await aPage.waitForURL(/\/admin$/, { timeout: 30_000 })
  await aCtx.storageState({ path: path.join(AUTH_DIR, "admin.json") })
  await aCtx.close()
})
