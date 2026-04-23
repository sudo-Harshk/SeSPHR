import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Cloud, Lock, ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import api from "@/services/api"

interface CloudFile {
  filename: string
  key_blob_preview: string
  iv: string
  policy: string
  algorithm: string
  size: number
  raw_meta: {
    key_blob: string
    iv: string
    policy: string
    algorithm: string
    mode: string
  }
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function MetaPanel({ meta }: { meta: CloudFile["raw_meta"] }) {
  const fields = [
    {
      key: "key_blob",
      value: meta.key_blob,
      label: "Encrypted AES key (cryptographic, not data)",
      color: "text-purple-700",
    },
    {
      key: "iv",
      value: meta.iv,
      label: "Initialization vector",
      color: "text-blue-700",
    },
    {
      key: "policy",
      value: meta.policy,
      label: "Access rule (not content)",
      color: "text-amber-700",
    },
    {
      key: "algorithm",
      value: meta.algorithm,
      label: "Encryption algorithm",
      color: "text-green-700",
    },
    {
      key: "mode",
      value: meta.mode,
      label: "Storage mode",
      color: "text-slate-600",
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Raw metadata — all fields are cryptographic metadata, not user data
        </p>
        <div className="font-mono text-xs space-y-2">
          <span className="text-slate-400">{"{"}</span>
          {fields.map((f) => (
            <div key={f.key} className="pl-4 flex flex-col gap-0.5">
              <div>
                <span className="text-slate-500">&quot;{f.key}&quot;</span>
                <span className="text-slate-400">: </span>
                <span className={f.color}>&quot;{f.value}&quot;</span>
                <span className="text-slate-400">,</span>
              </div>
              <div className="pl-2 text-[10px] text-slate-400 italic">
                ↑ {f.label}
              </div>
            </div>
          ))}
          <span className="text-slate-400">{"}"}</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function AdminCloudView() {
  const [files, setFiles] = useState<CloudFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchFiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get("/admin/cloud-raw")
      if (res.data.success) {
        setFiles(res.data.data.files)
      } else {
        setError(res.data.error || "Failed to load")
      }
    } catch {
      setError("Failed to fetch cloud files")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFiles() }, [])

  const toggleExpanded = (filename: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cloud Storage View</h1>
            <p className="text-muted-foreground mt-1">
              What the untrusted cloud server sees — exactly as stored on disk.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Primary guarantee banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-l-4 border-l-green-500 bg-green-50/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-green-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-green-900 text-base">
                  Cloud stores encrypted files and encrypted keys — never plaintext.
                </p>
                <p className="text-sm text-green-800">
                  No plaintext. No PII. Every filename is a UUID. Every key is RSA-OAEP ciphertext.
                  An attacker who compromises the cloud server learns nothing about the patient data.
                </p>
                <p className="text-sm font-semibold text-green-800 mt-1">
                  To read data, an attacker must compromise BOTH the Cloud AND the SRS simultaneously.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-12">{error}</div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Cloud className="h-12 w-12 mb-3 opacity-40" />
            <p>No encrypted files in cloud storage yet.</p>
            <p className="text-xs mt-1">Upload a file as a patient to see it appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-slate-500" />
                Encrypted Files ({files.length})
              </CardTitle>
              <CardDescription>
                UUID filenames · .enc extension · All content is ciphertext
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {[
                        "Filename (UUID)",
                        "Encrypted Key Blob (truncated)",
                        "IV",
                        "Access Policy (not content)",
                        "Size",
                        "Raw Metadata",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, i) => (
                      <>
                        <motion.tr
                          key={file.filename}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-700 break-all">{file.filename}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">.enc</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-purple-700">
                            {file.key_blob_preview}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-700">
                            {file.iv.slice(0, 12)}…
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 max-w-[180px] truncate" title={file.policy}>
                            {file.policy}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatBytes(file.size)}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => toggleExpanded(file.filename)}
                            >
                              {expanded.has(file.filename) ? (
                                <><ChevronUp className="h-3 w-3" /> Hide</>
                              ) : (
                                <><ChevronDown className="h-3 w-3" /> Inspect</>
                              )}
                            </Button>
                          </td>
                        </motion.tr>
                        {expanded.has(file.filename) && (
                          <tr key={`${file.filename}-meta`} className="bg-slate-50/50">
                            <td colSpan={6} className="px-6 py-3">
                              <AnimatePresence>
                                <MetaPanel meta={file.raw_meta} />
                              </AnimatePresence>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
