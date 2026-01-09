import { useEffect, useState } from "react"
import { FileText, Loader2, CheckCircle2, XCircle, Shield, Download } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import api from "@/services/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const MotionTableRow = motion(TableRow)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface FileItem {
  filename: string
  owner: string | null
  policy: string | null
}

interface ApiResponse {
  success: boolean
  data: {
    files: FileItem[]
  } | null
  error: string | null
}

interface AccessResult {
  filename: string
  status: "granted" | "denied" | null
  message: string | null
}

export default function DoctorFiles() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Concurrent state management using Sets
  const [accessing, setAccessing] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [accessResults, setAccessResults] = useState<Map<string, AccessResult>>(new Map())

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<ApiResponse>("/doctor/files")

        if (response.data.success && response.data.data?.files) {
          // Backend returns normalized filenames; use exactly as is.
          setFiles(response.data.data.files)
        } else {
          setError(response.data.error || "Failed to load files")
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch files")
        setFiles([])
      } finally {
        setLoading(false)
      }
    }

    fetchFiles()
  }, [])

  const handleAccess = async (filename: string) => {
    // Prevent multiple simultaneous access attempts for the same file
    if (accessing.has(filename)) return

    try {
      setAccessing((prev) => {
        const next = new Set(prev)
        next.add(filename)
        return next
      })

      // Reset previous result state for this file
      setAccessResults((prev) => {
        const newMap = new Map(prev)
        newMap.set(filename, { filename, status: null, message: null })
        return newMap
      })

      // STRICT CONTRACT: Send filename exactly as received.
      const response = await api.post("/doctor/access", {
        file: filename,
      })

      const status = response.data.data?.status

      if (response.data.success && status === "granted") {
        setAccessResults((prev) => {
          const newMap = new Map(prev)
          newMap.set(filename, {
            filename,
            status: "granted",
            message: "Access granted successfully",
          })
          return newMap
        })
      } else if (status === "denied" || response.data.status === "denied") {
        setAccessResults((prev) => {
          const newMap = new Map(prev)
          newMap.set(filename, {
            filename,
            status: "denied",
            message: response.data.reason || "Access denied",
          })
          return newMap
        })
      } else {
        throw new Error(response.data.error || "Unknown response")
      }
    } catch (err: any) {
      const message = getFriendlyErrorMessage(err)

      setAccessResults((prev) => {
        const newMap = new Map(prev)
        newMap.set(filename, {
          filename,
          status: "denied",
          message,
        })
        return newMap
      })
    } finally {
      setAccessing((prev) => {
        const next = new Set(prev)
        next.delete(filename)
        return next
      })
    }
  }

  const handleDownload = async (filename: string) => {
    // Security check: Only allow download if access was previously granted
    const accessResult = accessResults.get(filename)
    if (accessResult?.status !== "granted") {
      return
    }

    if (downloading.has(filename)) return

    try {
      setDownloading((prev) => {
        const next = new Set(prev)
        next.add(filename)
        return next
      })

      // STRICT CONTRACT: Send filename exactly as received.
      // Use query param download=true for file retrieval
      const response = await api.post(
        "/doctor/access",
        { file: filename },
        {
          params: { download: "true" },
          responseType: "blob",
        }
      )

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" })

      const url = window.URL.createObjectURL(blob)

      // content-disposition handling
      const contentDisposition = response.headers["content-disposition"]
      let downloadFilename = filename
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, "")
        }
      }

      const link = document.createElement("a")
      link.href = url
      link.download = downloadFilename
      document.body.appendChild(link)
      link.click()

      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      // SECURITY CRITICAL: Downgrade access status if download fails (policy re-eval)
      const message = getFriendlyErrorMessage(err, "Download failed")

      setAccessResults((prev) => {
        const newMap = new Map(prev)
        newMap.set(filename, {
          filename,
          status: "denied",
          message,
        })
        return newMap
      })
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev)
        next.delete(filename)
        return next
      })
    }
  }

  // Helper to map backend errors to user-friendly messages
  const getFriendlyErrorMessage = (err: any, defaultMsg: string = "Access denied"): string => {
    if (!err.response) return defaultMsg

    const status = err.response.status
    const data = err.response.data
    const backendMsg = (data?.error || data?.reason || data?.message || "").toLowerCase()

    // Map distinct backend outcomes to user-safe messages
    if (status === 403) {
      if (backendMsg.includes("policy")) return "Access denied by policy"
      if (backendMsg.includes("role") || backendMsg.includes("permission")) return "Insufficient permissions"
      return "Access denied"
    }

    if (status === 400 || status === 404) {
      return "File unavailable"
    }

    if (status === 401) {
      return "Authentication required"
    }

    return backendMsg || defaultMsg
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-slate-600">Loading accessible files...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accessible Health Records</h1>
          <p className="text-slate-600 mt-1">
            View Personal Health Records you have access to
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accessible Health Records</h1>
          <p className="text-slate-600 mt-1">
            View Personal Health Records you have access to
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No accessible files
            </h3>
            <p className="text-sm text-slate-600">
              There are no Personal Health Records available for you to access at this time.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">Accessible Health Records</h1>
        <p className="text-slate-600 mt-1">
          View Personal Health Records you have access to
        </p>
      </motion.div>

      {/* Access Result Messages */}
      <AnimatePresence>
        {Array.from(accessResults.values())
          .filter((result) => result.status !== null)
          .map((result) => (
            <motion.div
              key={result.filename}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={`p-3 border rounded-md flex items-start gap-2 ${result.status === "granted"
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
                }`}
            >
              {result.status === "granted" ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${result.status === "granted" ? "text-green-900" : "text-red-900"
                    }`}
                >
                  {result.filename}
                </p>
                <p
                  className={`text-sm ${result.status === "granted" ? "text-green-700" : "text-red-700"
                    }`}
                >
                  {result.status === "granted"
                    ? "✓ Access GRANTED"
                    : `✗ Access DENIED: ${result.message}`}
                </p>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              {files.length} {files.length === 1 ? "file" : "files"} accessible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file, index) => {
                  const isRevoked = file.policy?.toUpperCase().includes("REVOKED")
                  const isAccessing = accessing.has(file.filename)
                  const isDownloading = downloading.has(file.filename)
                  const accessResult = accessResults.get(file.filename)
                  const isGranted = accessResult?.status === "granted"
                  const isDenied = accessResult?.status === "denied"

                  return (
                    <MotionTableRow
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className={isRevoked ? "bg-slate-50 opacity-75" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${isRevoked ? "text-slate-300" : "text-slate-400"}`} />
                          <span className={isRevoked ? "text-slate-500 line-through" : ""}>{file.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{file.owner || "Unknown"}</TableCell>
                      <TableCell>
                        {file.policy && file.policy !== "N/A" ? (
                          <motion.span
                            key={`${file.filename}-policy`}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`px-2 py-1 rounded-md text-xs font-medium ${isRevoked
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : "bg-green-100 text-green-800"
                              }`}
                          >
                            {file.policy}
                          </motion.span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <motion.div
                            key={`${file.filename}-${accessResult?.status || "none"}`}
                            initial={isGranted || isDenied ? { scale: 0.8, opacity: 0 } : false}
                            animate={isGranted || isDenied ? { scale: 1, opacity: 1 } : false}
                            transition={{ duration: 0.3, type: "spring", stiffness: 400 }}
                          >
                            <Button
                              variant={isRevoked ? "ghost" : isGranted ? "default" : isDenied ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => handleAccess(file.filename)}
                              disabled={isAccessing || !!isRevoked}
                              className="gap-2"
                            >
                              {isAccessing ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Checking...
                                </>
                              ) : isGranted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Granted
                                </>
                              ) : isDenied ? (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Denied
                                </>
                              ) : isRevoked ? (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Revoked
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3 h-3" />
                                  Access
                                </>
                              )}
                            </Button>
                          </motion.div>

                          {isGranted && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.3, type: "spring", stiffness: 400 }}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(file.filename)}
                                disabled={isDownloading}
                                className="gap-2"
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3" />
                                    Download
                                  </>
                                )}
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </TableCell>
                    </MotionTableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
