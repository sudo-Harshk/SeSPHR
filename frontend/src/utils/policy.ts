/**
 * Mirrors backend/app/services/policy/parser.py evaluate_policy
 * so the doctor UI matches server access decisions.
 */
export function evaluatePolicy(
  attributes: Record<string, string>,
  policyStr: string | null | undefined
): boolean {
  if (!policyStr || policyStr === "N/A") {
    return true
  }

  const processedPolicy = policyStr.replace(/[\w-]+:[\w-]+/g, (rule) => {
    const idx = rule.indexOf(":")
    if (idx === -1) return rule
    const attr = rule.slice(0, idx).trim()
    const val = rule.slice(idx + 1).trim()
    const userVal = String(attributes[attr] ?? "")
    return userVal === val ? "True" : "False"
  })

  const normalized = processedPolicy.replace(/AND/g, "and").replace(/OR/g, "or")

  if (!/^[TrueFalseandor\s()]+$/.test(normalized)) {
    return false
  }

  const jsExpr = normalized
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")

  try {
    // eslint-disable-next-line no-new-func
    return Boolean(Function(`"use strict"; return (${jsExpr})`)())
  } catch {
    return false
  }
}
