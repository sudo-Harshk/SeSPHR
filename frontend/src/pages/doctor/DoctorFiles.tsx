import { useEffect, useState } from "react"
import { FileText, Loader2, Shield, Eye, Download, XCircle } from "lucide-react"
import FilePreviewModal from "@/components/FilePreviewModal"
import { motion } from "framer-motion"
import api from "@/services/api"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { importPrivateKey, unwrapKey, decryptFile } from "@/utils/crypto"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const MotionTableRow = motion.create(TableRow)

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
  key_blob?: string
  iv?: string
  file_url?: string
}

export default function DoctorFiles() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Concurrent state management using Sets
  const [accessing, setAccessing] = useState<Set<string>>(new Set())
  const [restoring, setRestoring] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [accessResults, setAccessResults] = useState<Map<string, AccessResult>>(new Map())
  const [doctorPrivateKey, setDoctorPrivateKey] = useState<CryptoKey | null>(null)

  // Preview State
  const [previewFile, setPreviewFile] = useState<{
    isOpen: boolean
    fileUrl: string | null
    filename: string
    mimeType: string
  }>({
    isOpen: false,
    fileUrl: null,
    filename: "",
    mimeType: "",
  })

  // 1. Fetch Doctor's Private Key on Mount
  useEffect(() => {
    api.get("/debug/my-private-key").then(async (res) => {
      if (res.data.success && res.data.data?.private_key) {
        try {
          const key = await importPrivateKey(res.data.data.private_key)
          setDoctorPrivateKey(key)
        } catch (e) {
          console.error("Failed to import private key", e)
          toast.error("Failed to load your private encryption key. Access will be limited.")
        }
      }
    }).catch(() => {
      console.warn("Could not fetch private key. Maybe not generated yet?")
    })
  }, [])

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await api.get<ApiResponse>("/doctor/files")

        if (response.data.success && response.data.data?.files) {
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

  // Auto-restore access
  useEffect(() => {
    if (files.length === 0 || accessing.size > 0) return

    const restored = sessionStorage.getItem("unlocked_files")
    if (restored) {
      try {
        const filenames: string[] = JSON.parse(restored)
        filenames.forEach(f => {
          if (!accessResults.has(f) && files.some(file => file.filename === f)) {
            handleAccess(f, true)
          }
        })
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, [files])

  const handleAccess = async (filename: string, isRestore = false) => {
    if (accessing.has(filename) || restoring.has(filename)) return

    try {
      if (isRestore) {
        setRestoring((prev) => { const next = new Set(prev); next.add(filename); return next; })
      } else {
        setAccessing((prev) => { const next = new Set(prev); next.add(filename); return next; })
      }

      setAccessResults((prev) => {
        const newMap = new Map(prev)
        // Reset or clear previous entry if needed, but 'granted' state is what matters
        if (!isRestore) newMap.delete(filename)
        return newMap
      })

      const response = await api.post("/doctor/access", { file: filename })
      const status = response.data.data?.status

      if (response.data.success && status === "granted") {
        setAccessResults((prev) => {
          const newMap = new Map(prev)
          newMap.set(filename, {
            filename,
            status: "granted",
            key_blob: response.data.data.key_blob,
            iv: response.data.data.iv,
            file_url: response.data.data.file_url
          })

          const currentUnlocked = JSON.parse(sessionStorage.getItem("unlocked_files") || "[]")
          if (!currentUnlocked.includes(filename)) {
            sessionStorage.setItem("unlocked_files", JSON.stringify([...currentUnlocked, filename]))
          }
          return newMap
        })

        if (!isRestore) {
          toast.success(`Access GRANTED for ${filename}`)
        }

      } else if (status === "denied" || response.data.status === "denied") {
        const reason = response.data.reason || "Access denied"
        setAccessResults((prev) => {
          const newMap = new Map(prev)
          newMap.set(filename, { filename, status: "denied" })
          return newMap
        })

        if (!isRestore) {
          toast.error(`Access DENIED: ${reason}`)
        }
      } else {
        throw new Error(response.data.error || "Unknown response")
      }
    } catch (err: any) {
      const message = getFriendlyErrorMessage(err)
      setAccessResults((prev) => {
        const newMap = new Map(prev)
        newMap.set(filename, { filename, status: "denied" })
        return newMap
      })

      if (!isRestore) {
        toast.error(`Access DENIED: ${message}`)
      }
    } finally {
      if (isRestore) {
        setRestoring((prev) => { const next = new Set(prev); next.delete(filename); return next; })
      } else {
        setAccessing((prev) => { const next = new Set(prev); next.delete(filename); return next; })
      }
    }
  }

  const fetchAndDecryptFile = async (filename: string): Promise<{ blob: Blob, filename: string } | null> => {
    const accessResult = accessResults.get(filename)
    if (accessResult?.status !== "granted") return null

    try {
      let downloadUrl = accessResult?.file_url || `/doctor/download/${filename}.enc`
      if (downloadUrl.startsWith("/api")) downloadUrl = downloadUrl.substring(4)

      const response = await api.get(downloadUrl, { responseType: "blob" })

      let finalBlob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" })

      if (accessResult?.key_blob && accessResult?.iv && doctorPrivateKey) {
        try {
          const wrappedKey = accessResult.key_blob
          const iv = accessResult.iv
          const aesKey = await unwrapKey(wrappedKey, doctorPrivateKey)
          finalBlob = await decryptFile(finalBlob, aesKey, iv)
        } catch (cryptoError) {
          console.error("Decryption failed:", cryptoError)
          toast.warning("Decryption failed! Using raw file.")
        }
      }

      const contentDisposition = response.headers["content-disposition"]
      let downloadFilename = filename
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) downloadFilename = match[1].replace(/['"]/g, "")
      }
      if (downloadFilename.endsWith(".enc")) downloadFilename = downloadFilename.replace(".enc", "")

      // Force valid MIME type for PDFs so the browser can render it
      if (downloadFilename.toLowerCase().endsWith(".pdf")) {
        finalBlob = new Blob([finalBlob], { type: "application/pdf" })
      }

      return { blob: finalBlob, filename: downloadFilename }
    } catch (err: any) {
      console.error("Fetch failed", err)
      throw err
    }
  }

  const handleView = async (filename: string) => {
    if (downloading.has(filename)) return

    try {
      setDownloading((prev) => { const next = new Set(prev); next.add(filename); return next; })
      const result = await fetchAndDecryptFile(filename)
      if (!result) return

      const url = window.URL.createObjectURL(result.blob)

      setPreviewFile({
        isOpen: true,
        fileUrl: url,
        filename: result.filename,
        mimeType: result.blob.type
      })

    } catch (err: any) {
      const message = getFriendlyErrorMessage(err, "View failed")
      toast.error(message)
    } finally {
      setDownloading((prev) => { const next = new Set(prev); next.delete(filename); return next; })
    }
  }

  const handleDownload = async (filename: string) => {
    if (downloading.has(filename)) return

    try {
      setDownloading((prev) => { const next = new Set(prev); next.add(filename); return next; })
      const result = await fetchAndDecryptFile(filename)
      if (!result) return

      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)
      toast.success("File downloaded successfully")

    } catch (err: any) {
      const message = getFriendlyErrorMessage(err, "Download failed")
      toast.error(message)
    } finally {
      setDownloading((prev) => { const next = new Set(prev); next.delete(filename); return next; })
    }
  }

  const getFriendlyErrorMessage = (err: any, defaultMsg: string = "Access denied"): string => {
    if (!err.response) return defaultMsg
    const status = err.response.status
    const data = err.response.data
    const backendMsg = (data?.error || data?.reason || data?.message || "").toLowerCase()

    if (status === 403) {
      if (backendMsg.includes("revoked")) return "Access Denied by Authority (REVOKED)"
      if (backendMsg.includes("policy")) return "Access Denied by Policy"
      return "Access Denied by Authority"
    }
    if (status === 400 || status === 404) return "File unavailable"
    if (status === 401) return "Authentication required"
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
          <p className="text-slate-600 mt-1">View Personal Health Records you have access to</p>
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
          <p className="text-slate-600 mt-1">View Personal Health Records you have access to</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No accessible files</h3>
            <p className="text-sm text-slate-600">There are no Personal Health Records available for you to access at this time.</p>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Accessible Health Records</h1>
            <p className="text-slate-600 mt-1">View Personal Health Records you have access to</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${doctorPrivateKey
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
            <Shield className="w-4 h-4" />
            {doctorPrivateKey ? "Identity Token Loaded" : "Identity Token Missing"}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>{files.length} {files.length === 1 ? "file" : "files"} accessible</CardDescription>
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
                  const isRestoring = restoring.has(file.filename)
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
                            initial={false}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            {isGranted ? (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleView(file.filename)}
                                  disabled={isDownloading}
                                  className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                                >
                                  {isDownloading ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Loading...
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3 h-3" />
                                      View
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownload(file.filename)}
                                  disabled={isDownloading}
                                  className="gap-2"
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant={isRevoked ? "ghost" : isDenied ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => handleAccess(file.filename)}
                                disabled={isAccessing || isRestoring || !!isRevoked}
                                className="gap-2"
                              >
                                {isRestoring ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Re-verifying...
                                  </>
                                ) : isAccessing ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Checking...
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
                            )}
                          </motion.div>
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

      <FilePreviewModal
        isOpen={previewFile.isOpen}
        onClose={() => {
          if (previewFile.fileUrl) window.URL.revokeObjectURL(previewFile.fileUrl)
          setPreviewFile({ ...previewFile, isOpen: false, fileUrl: null })
        }}
        fileUrl={previewFile.fileUrl}
        filename={previewFile.filename}
        mimeType={previewFile.mimeType}
      />
    </div>
  )
}
