import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const E2E_SEED_BASENAME = "e2e-seed.txt"

/** Directory containing Playwright storage state JSON files (created by auth.setup). */
export function authDir(): string {
  return path.join(__dirname, "../../playwright/.auth")
}

export const storageStateFiles = {
  admin: path.join(authDir(), "admin.json"),
  doctor: path.join(authDir(), "doctor.json"),
  patient: path.join(authDir(), "patient.json"),
}

export const seedFixturePath = path.join(__dirname, "fixtures", "e2e-seed.txt")

export function seedInfoPath(): string {
  return path.join(authDir(), "seed-info.json")
}

export function readSeedInfo(): { filename: string; encFilename: string } {
  const p = seedInfoPath()
  const raw = fs.readFileSync(p, "utf-8")
  return JSON.parse(raw) as { filename: string; encFilename: string }
}

/** Coefficient of variation = stdev / mean (sample stdev with n-1) */
export function coefficientOfVariation(values: number[]): number {
  const n = values.length
  if (n < 2) throw new Error("CV needs at least 2 values")
  const mean = values.reduce((a, b) => a + b, 0) / n
  if (mean === 0) return 0
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)
  return Math.sqrt(variance) / mean
}
