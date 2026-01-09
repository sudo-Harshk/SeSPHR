import { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import api from "@/services/api"

export interface PolicyRule {
  key: string
  value: string
  operator?: "AND" | "OR"
}

interface PolicyBuilderProps {
  value: string
  onChange: (policy: string) => void
}

// Default attribute options (fallback if API fails)
const defaultAttributeOptions: Record<string, string[]> = {
  Role: ["Doctor", "Nurse", "Admin", "Patient"],
  Dept: ["Cardiology", "Neurology", "Pediatrics", "Emergency", "Surgery"],
  Specialization: ["Cardiologist", "Neurologist", "Pediatrician", "Surgeon"],
}

export default function PolicyBuilder({ value, onChange }: PolicyBuilderProps) {
  const [rules, setRules] = useState<PolicyRule[]>([
    { key: "", value: "", operator: undefined },
  ])
  const [attributeOptions, setAttributeOptions] = useState<Record<string, string[]>>(defaultAttributeOptions)

  // Fetch real attributes from API
  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const response = await api.get("/admin/users")

        if (response.data.success && response.data.data?.users) {
          // Extract unique attribute keys and values from all users
          const attributes: Record<string, Set<string>> = {}

          response.data.data.users.forEach((user: { attributes: Record<string, string> }) => {
            Object.entries(user.attributes).forEach(([key, value]) => {
              if (!attributes[key]) {
                attributes[key] = new Set()
              }
              attributes[key].add(value)
            })
          })

          // Convert Sets to Arrays and sort
          const attributeOptionsMap: Record<string, string[]> = {}
          Object.entries(attributes).forEach(([key, values]) => {
            attributeOptionsMap[key] = Array.from(values).sort()
          })

          // Merge with defaults (in case API doesn't have all attributes yet)
          setAttributeOptions({
            ...defaultAttributeOptions,
            ...attributeOptionsMap,
          })
        }
      } catch (err) {
        // If API call fails (e.g., user is not admin), use defaults
        console.warn("Failed to fetch attributes from API, using defaults", err)
        setAttributeOptions(defaultAttributeOptions)
      }
    }

    fetchAttributes()
  }, [])

  const attributeKeys = Object.keys(attributeOptions)

  // Parse existing policy string into rules
  const parsePolicy = (policyStr: string): PolicyRule[] => {
    if (!policyStr.trim()) {
      return [{ key: "", value: "", operator: undefined }]
    }

    const parts = policyStr.split(/\s+(AND|OR)\s+/i)
    const parsedRules: PolicyRule[] = []

    for (let i = 0; i < parts.length; i += 2) {
      const rulePart = parts[i].trim()
      const operator = i + 1 < parts.length ? (parts[i + 1].toUpperCase() as "AND" | "OR") : undefined

      if (rulePart.includes(":")) {
        const [key, value] = rulePart.split(":").map((s) => s.trim())
        parsedRules.push({ key, value, operator })
      }
    }

    return parsedRules.length > 0 ? parsedRules : [{ key: "", value: "", operator: undefined }]
  }

  // Initialize rules from value prop
  useEffect(() => {
    if (value) {
      const parsed = parsePolicy(value)
      setRules(parsed)
    }
  }, [])

  const generatePolicyString = (currentRules: PolicyRule[]): string => {
    return currentRules
      .filter((rule) => rule.key && rule.value)
      .map((rule, index) => {
        const ruleStr = `${rule.key}:${rule.value}`
        return index > 0 && rule.operator ? `${rule.operator} ${ruleStr}` : ruleStr
      })
      .join(" ")
  }

  const updateRule = (index: number, updates: Partial<PolicyRule>) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], ...updates }
    setRules(newRules)
    onChange(generatePolicyString(newRules))
  }

  const addRule = () => {
    const newRules = [...rules, { key: "", value: "", operator: "AND" as const }]
    setRules(newRules)
  }

  const removeRule = (index: number) => {
    if (rules.length === 1) {
      setRules([{ key: "", value: "", operator: undefined }])
      onChange("")
      return
    }
    const newRules = rules.filter((_, i) => i !== index)
    setRules(newRules)
    onChange(generatePolicyString(newRules))
  }

  const getAvailableValues = (key: string): string[] => {
    return attributeOptions[key] || []
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {rules.map((rule, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2"
            >
              {index > 0 && (
                <select
                  value={rule.operator || "AND"}
                  onChange={(e) =>
                    updateRule(index, { operator: e.target.value as "AND" | "OR" })
                  }
                  className="h-10 px-3 border rounded-md text-sm bg-white"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}

              <select
                value={rule.key}
                onChange={(e) => {
                  const newKey = e.target.value
                  updateRule(index, { key: newKey, value: "" })
                }}
                className="h-10 px-3 border rounded-md text-sm bg-white flex-1"
              >
                <option value="">Select attribute...</option>
                {attributeKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <select
                value={rule.value}
                onChange={(e) => updateRule(index, { value: e.target.value })}
                disabled={!rule.key}
                className="h-10 px-3 border rounded-md text-sm bg-white flex-1 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Select value...</option>
                {rule.key &&
                  getAvailableValues(rule.key).map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
              </select>

              {rules.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(index)}
                  className="h-10 w-10"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addRule}
        className="w-full"
        disabled={rules.length === 0 || !rules[rules.length - 1].key || !rules[rules.length - 1].value}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Rule
      </Button>

      {/* Policy Preview */}
      <AnimatePresence>
        {value && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="p-3 bg-slate-50 border border-slate-200 rounded-md overflow-hidden"
          >
            <p className="text-xs font-medium text-slate-600 mb-1">Generated Policy:</p>
            <p className="text-sm font-mono text-slate-900 break-all">{value}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

