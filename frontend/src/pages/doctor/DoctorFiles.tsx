import { useEffect, useState } from "react"
import { FileText, Loader2, Shield, Eye, Download, Info } from "lucide-react"
import FilePreviewModal from "@/components/FilePreviewModal"
import { motion } from "framer-motion"
import api from "@/services/api"
import { useAuth } from "@/context/AuthContext"
import { evaluatePolicy } from "@/utils/policy"
import { mimeFromFilename } from "@/utils/mime"
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
import FileDetailsDialog from "@/components/FileDetailsDialog"
import { Skeleton } from "@/components/ui/skeleton"

const MotionTableRow = motion.create(TableRow)

interface FileItem {
  filename: string
  owner: string | null
  date?: number // timestamp (seconds since epoch from server)
  size?: number // bytes
  policy: string | null
  iv?: string
  key_blob?: string
  algorithm?: string
  revoked_users?: string[]
  portions?: { name: string; policy: string }[]
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
  portions?: {
    name: string
    key_blob: string
    iv: string
  }[]
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/** Aligns with backend access rules for UI enable/disable (full-file decrypt). */
function computeAccessRow(
  file: FileItem,
  userId: string | null,
  attributes: Record<string, string>
) {
  const revokedList = file.revoked_users ?? []
  const isRevoked = Boolean(userId && revokedList.includes(userId))
  const globalMatch = evaluatePolicy(attributes, file.policy)
  const portions = file.portions ?? []
  const portionMatch = portions.some((p) => evaluatePolicy(attributes, p.policy))
  const policyDenied =
    typeof file.policy === "string" && file.policy.toLowerCase().includes("__revoked__")
  const canDecryptFullFile = globalMatch && !isRevoked && !policyDenied
  return {
    isRevoked,
    globalMatch,
    portionMatch,
    policyDenied,
    canDecryptFullFile,
  }
}

export default function DoctorFiles() {
  const { userId, attributes } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Concurrent state management using Sets
  const [accessing, setAccessing] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [accessResults, setAccessResults] = useState<Map<string, AccessResult>>(new Map())
  const [doctorPrivateKey, setDoctorPrivateKey] = useState<CryptoKey | null>(null)

  // Preview State
  const [previewFile, setPreviewFile] = useState<{
    isOpen: boolean
    fileUrl: string | null
    filename: string
    mimeType: string
    portions: { name: string; key_blob: string; iv: string }[]
  }>({
    isOpen: false,
    fileUrl: null,
    filename: "",
    mimeType: "",
    portions: [],
  })

  // Details Dialog State
  const [selectedFileDetails, setSelectedFileDetails] = useState<FileItem | null>(null)

  // Load RSA private key: in development auto-provision via ensure-my-keys; else fetch only.
  useEffect(() => {
    if (!userId) return

    const loadPrivateKey = async () => {
      const applyPem = async (pem: string) => {
        try {
          const key = await importPrivateKey(pem)
          setDoctorPrivateKey(key)
        } catch (e) {
          console.error("Failed to import private key", e)
          toast.error("Failed to load your private encryption key.")
        }
      }

      try {
        const ensure = await api.post("/debug/ensure-my-keys")
        if (ensure.data.success && ensure.data.data?.private_key) {
          await applyPem(ensure.data.data.private_key)
          return
        }
      } catch {
        // Production or ensure disabled — fall back to read-only fetch
      }

      try {
        const res = await api.get("/debug/my-private-key")
        if (res.data.success && res.data.data?.private_key) {
          await applyPem(res.data.data.private_key)
          return
        }
      } catch {
        /* 404 expected if keys never created */
      }

      toast.message(
        "No encryption keys for your account. Run the app with FLASK_ENV=development so keys are created automatically, or ask an admin to generate keys.",
        { duration: 6000 }
      )
    }

    loadPrivateKey()
  }, [userId])

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
            requestAccess(f, true)
          }
        })
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, [files])

  const requestAccess = async (filename: string, isRestore = false): Promise<AccessResult | null> => {
    if (accessing.has(filename)) return null // Already in progress

    try {
      if (!isRestore) {
        setAccessing((prev) => { const next = new Set(prev); next.add(filename); return next; })
      }

      const response = await api.post("/doctor/access", { file: filename })
      const status = response.data.data?.status

      if (response.data.success && status === "granted") {
        const result: AccessResult = {
          filename,
          status: "granted",
          key_blob: response.data.data.key_blob,
          iv: response.data.data.iv,
          file_url: response.data.data.file_url,
          portions: response.data.data.portions || []
        }

        setAccessResults((prev) => {
          const newMap = new Map(prev)
          newMap.set(filename, result)
          // Only persist files we can actually decrypt (global key present)
          if (result.key_blob) {
            const currentUnlocked = JSON.parse(sessionStorage.getItem("unlocked_files") || "[]")
            if (!currentUnlocked.includes(filename)) {
              sessionStorage.setItem("unlocked_files", JSON.stringify([...currentUnlocked, filename]))
            }
          }
          return newMap
        })

        return result

      } else {
        const reason = response.data.reason || "Access denied"
        const result: AccessResult = { filename, status: "denied" }
        setAccessResults((prev) => {
          const newMap = new Map(prev)
          newMap.set(filename, result)
          return newMap
        })
        if (!isRestore) toast.error(`Access DENIED: ${reason}`)
        return result
      }
    } catch (err: any) {
      const message = getFriendlyErrorMessage(err)
      const result: AccessResult = { filename, status: "denied" }
      setAccessResults((prev) => {
        const newMap = new Map(prev)
        newMap.set(filename, result)
        return newMap
      })
      if (!isRestore) toast.error(`Access DENIED: ${message}`)
      return result
    } finally {
      if (!isRestore) {
        setAccessing((prev) => { const next = new Set(prev); next.delete(filename); return next; })
      }
    }
  }

  const fetchAndDecryptFile = async (filename: string): Promise<{ blob: Blob, filename: string } | null> => {
    // 1. Check if we have access result
    let accessResult = accessResults.get(filename)

    // 2. If not granted or missing, try to request access immediately
    if (accessResult?.status !== "granted") {
      accessResult = await requestAccess(filename) || undefined
    }

    if (accessResult?.status !== "granted") return null

    if (!accessResult.key_blob || !accessResult.iv) {
      toast.error(
        "No file key for your account: global policy does not include you (portion-only access cannot decrypt this single encrypted file). Ask the patient to grant access via the main record policy."
      )
      return null
    }

    if (!doctorPrivateKey) {
      toast.error("Encryption key not loaded — cannot decrypt this record.")
      return null
    }

    try {
      let downloadUrl = accessResult?.file_url || `/doctor/download/${filename}.enc`
      if (downloadUrl.startsWith("/api")) downloadUrl = downloadUrl.substring(4)

      const response = await api.get(downloadUrl, { responseType: "blob" })

      let finalBlob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" })

      try {
        const aesKey = await unwrapKey(accessResult.key_blob, doctorPrivateKey)
        finalBlob = await decryptFile(finalBlob, aesKey, accessResult.iv)
      } catch (cryptoError) {
        console.error("Decryption failed:", cryptoError)
        toast.error("Decryption failed — the file may be corrupted or keys may not match.")
        return null
      }

      const contentDisposition = response.headers["content-disposition"]
      let downloadFilename = filename
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match && match[1]) downloadFilename = match[1].replace(/['"]/g, "")
      }
      if (downloadFilename.endsWith(".enc")) downloadFilename = downloadFilename.replace(".enc", "")

      const extMime = mimeFromFilename(downloadFilename)
      if (downloadFilename.toLowerCase().endsWith(".pdf")) {
        finalBlob = new Blob([finalBlob], { type: "application/pdf" })
      } else if (!finalBlob.type && extMime) {
        finalBlob = new Blob([finalBlob], { type: extMime })
      }

      return { blob: finalBlob, filename: downloadFilename }
    } catch (err: any) {
      console.error("Fetch failed", err)
      throw err
    }
  }

  const handleView = async (filename: string) => {
    if (downloading.has(filename) || accessing.has(filename)) return

    try {
      setDownloading((prev) => { const next = new Set(prev); next.add(filename); return next; })
      const result = await fetchAndDecryptFile(filename)
      if (!result) return

      const url = window.URL.createObjectURL(result.blob)
      const mimeType = result.blob.type || mimeFromFilename(result.filename)

      setPreviewFile({
        isOpen: true,
        fileUrl: url,
        filename: result.filename,
        mimeType,
        portions: accessResults.get(filename)?.portions || []
      })
      toast.success("Record decrypted in your browser — ciphertext was not decrypted on the server.")

    } catch (err: any) {
      const message = getFriendlyErrorMessage(err, "View failed")
      toast.error(message)
    } finally {
      setDownloading((prev) => { const next = new Set(prev); next.delete(filename); return next; })
    }
  }

  const handleDownload = async (filename: string) => {
    if (downloading.has(filename) || accessing.has(filename)) return

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
      toast.success("Decrypted file downloaded (decryption happened in your browser).")

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
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accessible Health Records</h1>
          <p className="text-slate-600 mt-1">View Personal Health Records you have access to</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription><Skeleton className="h-4 w-[100px]" /></CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="h-[68px]">
                  <TableHead className="w-[1%] max-w-[400px] whitespace-nowrap px-4">File Name</TableHead>
                  <TableHead className="w-[120px] px-4">Date</TableHead>
                  <TableHead className="w-[150px] px-4">Owner</TableHead>
                  <TableHead className="w-[120px] px-4">Policy</TableHead>
                  <TableHead className="w-auto whitespace-nowrap px-4 text-right">Size</TableHead>
                  <TableHead className="w-auto whitespace-nowrap px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i} className="h-[68px]">
                    <TableCell className="px-4 py-0">
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-0">
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell className="px-4 py-0">
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell className="px-4 py-0">
                      <Skeleton className="h-6 w-[80px] rounded-md" />
                    </TableCell>
                    <TableCell className="px-4 py-0">
                      <Skeleton className="h-4 w-[60px]" />
                    </TableCell>
                    <TableCell className="px-4 py-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-[80px]" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Accessible Health Records</h1>
            <p className="text-slate-600 mt-1">
              Records stored in the system. View/Download are enabled only when your attributes satisfy the file policy and you have a loaded identity key.
            </p>
          </div>
          <div className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${doctorPrivateKey
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
            <Shield className="w-4 h-4" />
            {doctorPrivateKey ? "Identity key loaded" : "Identity key missing"}
          </div>
        </div>
        {Object.keys(attributes).length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Your access attributes </span>
            <span className="text-slate-500">(used with policies such as Role:Doctor, Dept:Cardiology):</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(attributes).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-800"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              {files.length} record{files.length === 1 ? "" : "s"} in cloud storage — access is enforced by policy on the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="h-[68px]">
                  <TableHead className="w-auto px-4">File Name</TableHead>
                  <TableHead className="w-[120px] px-4">Date</TableHead>
                  <TableHead className="w-[150px] px-4">Owner</TableHead>
                  <TableHead className="w-[120px] px-4">Policy</TableHead>
                  <TableHead className="w-[100px] px-4">Size</TableHead>
                  <TableHead className="w-[160px] whitespace-nowrap px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file, index) => {
                  const rowAccess = computeAccessRow(file, userId, attributes)
                  const isAccessing = accessing.has(file.filename)
                  const isDownloading = downloading.has(file.filename)

                  const isBlocked =
                    rowAccess.isRevoked ||
                    rowAccess.policyDenied ||
                    (!rowAccess.canDecryptFullFile && !rowAccess.portionMatch)

                  const isPortionsOnly = !rowAccess.canDecryptFullFile && rowAccess.portionMatch

                  const rowClass = `h-[68px] transition-colors ${
                    rowAccess.isRevoked || rowAccess.policyDenied
                      ? "bg-slate-50/50"
                      : isPortionsOnly
                        ? "bg-amber-50/20"
                        : "hover:bg-slate-50/50"
                  }`

                  const nameClass =
                    rowAccess.isRevoked || rowAccess.policyDenied || isBlocked
                      ? "text-slate-500"
                      : "text-slate-900"
                  const ownerClass = isBlocked ? "text-slate-400" : "text-slate-500"

                  let pillClass = ""
                  let pillText = ""

                  if (rowAccess.isRevoked) {
                    pillClass = "bg-slate-100 text-slate-600 border-slate-200"
                    pillText = "Revoked"
                  } else if (rowAccess.policyDenied) {
                    pillClass = "bg-slate-100 text-slate-500 border-slate-200"
                    pillText = "Revoked (policy)"
                  } else if (rowAccess.canDecryptFullFile) {
                    pillClass = "bg-green-50 text-green-700 border-green-200"
                    pillText = "Full access"
                  } else if (isPortionsOnly) {
                    pillClass = "bg-amber-50 text-amber-800 border-amber-200"
                    pillText = "Portions only"
                  } else {
                    pillClass = "bg-red-50 text-red-600 border-red-200"
                    pillText = "No access"
                  }

                  const canView =
                    rowAccess.canDecryptFullFile && !!doctorPrivateKey
                  const canDownload = canView

                  const isGlobalLoading = isAccessing || isDownloading

                  return (
                    <MotionTableRow
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className={rowClass}
                    >
                      <TableCell className="px-4 py-0 font-medium h-[68px]">
                        <div className="h-full flex items-center gap-1.5">
                          <FileText className={`w-4 h-4 shrink-0 ${isBlocked ? "text-slate-400" : "text-slate-500"}`} />
                          <div className="max-w-[400px]">
                            <span className={`block truncate font-semibold ${nameClass}`}>{file.filename}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-0 h-[68px]">
                        <div className={`h-full flex items-center truncate text-xs ${ownerClass}`}>
                          {file.date != null && file.date > 0 ? (
                            new Date(file.date * 1000).toLocaleDateString("en-US", {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          ) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-0 h-[68px]">
                        <div className={`h-full flex items-center truncate text-xs ${ownerClass}`}>
                          <span className="truncate max-w-[150px]">{file.owner || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-0 h-[68px]">
                        <div className="h-full flex items-center">
                          <motion.span
                            key={`${file.filename}-policy`}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`h-6 box-border border flex items-center justify-center text-xs font-medium leading-none px-2 rounded-md ${pillClass}`}
                          >
                            {pillText}
                          </motion.span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-0 h-[68px]">
                        <div className={`h-full flex items-center truncate text-xs ${ownerClass}`}>
                          {file.size ? formatBytes(file.size) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-0 text-right h-[68px]">
                        <div className="h-full flex items-center justify-end gap-2">
                          {/* Info: Disabled if Revoked/Denied */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedFileDetails(file)}
                            className="h-8 w-8 p-0"
                            title="File metadata"
                          >
                            <Info className="w-4 h-4 text-slate-400" />
                          </Button>

                          {/* View: Primary */}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleView(file.filename)}
                            disabled={!canView || isGlobalLoading}
                            title={
                              !doctorPrivateKey
                                ? "Load your identity key first"
                                : isPortionsOnly
                                  ? "Full file key not shared — portion-only access cannot decrypt this upload"
                                  : undefined
                            }
                            className={`h-8 px-3 gap-2 shadow-sm whitespace-nowrap ${!canView
                              ? "bg-slate-100 text-slate-400 border border-slate-200" // Disabled look
                              : "bg-slate-900 text-white hover:bg-slate-800"
                              }`}
                          >
                            {isAccessing || isDownloading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            View
                          </Button>

                          {/* Download: Secondary */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(file.filename)}
                            disabled={!canDownload || isGlobalLoading}
                            title={!doctorPrivateKey ? "Identity key required" : undefined}
                            className={`h-8 w-8 p-0 ${!canDownload ? "opacity-50" : ""}`}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
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
        portions={previewFile.portions}
      />

      <FileDetailsDialog
        open={!!selectedFileDetails}
        onOpenChange={(open) => !open && setSelectedFileDetails(null)}
        file={selectedFileDetails}
      />
    </div>
  )
}
