/**
 * Mirrors backend/app/services/policy/parser.py evaluate_policy
 * so the doctor UI matches server access decisions.
 */

function normalizePolicyInput(policyStr: string): string {
  return policyStr.trim().replace(/\s+/g, " ")
}

export function evaluatePolicy(
  attributes: Record<string, string>,
  policyStr: string | null | undefined
): boolean {
  if (!policyStr || policyStr === "N/A") {
    return true
  }

  const normalizedInput = normalizePolicyInput(policyStr)

  const processedPolicy = normalizedInput.replace(/[\w-]+:[\w-]+/g, (rule) => {
    const idx = rule.indexOf(":")
    if (idx === -1) return rule
    const attr = rule.slice(0, idx).trim()
    const val = rule.slice(idx + 1).trim()
    const userVal = String(attributes[attr] ?? "")
    return userVal === val ? "True" : "False"
  })

  // Normalise operators to lowercase words first, then convert to JS operators
  let normalized = processedPolicy
    .replace(/\band\b/gi, "and")
    .replace(/\bor\b/gi, "or")
    .replace(/\s+/g, " ")
    .trim()

  if (!/^[TrueFalseandor\s()]+$/.test(normalized)) {
    return false
  }

  // Convert Python-style booleans + operators → valid JavaScript
  const jsExpr = normalized
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\band\b/g, "&&")   // "and" is not valid JS — must be &&
    .replace(/\bor\b/g, "||")    // "or"  is not valid JS — must be ||

  try {
    // eslint-disable-next-line no-new-func
    return Boolean(Function(`"use strict"; return (${jsExpr})`)())
  } catch {
    return false
  }
}

/** Patient upload UI: classify policy for messaging (not used for enforcement). */
export type UploadPolicyPreview =
  | { kind: "department"; department: string }
  | { kind: "all_doctors" }
  | { kind: "admin" }
  | { kind: "custom" }

export function getUploadPolicyPreview(policy: string): UploadPolicyPreview {
  const t = policy.trim()
  const deptMatch = t.match(/(?:^|\s)Dept:([\w-]+)/i)
  const hasAnd = /\band\b/i.test(t)
  if (deptMatch && hasAnd) {
    return { kind: "department", department: deptMatch[1] }
  }
  if (t === "Role:Doctor") {
    return { kind: "all_doctors" }
  }
  if (t === "Role:Admin") {
    return { kind: "admin" }
  }
  return { kind: "custom" }
}
