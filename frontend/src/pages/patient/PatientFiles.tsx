import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Loader2, Upload, Info, ShieldX, Unlock } from "lucide-react"
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

const MotionTableRow = motion.create(TableRow)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

import ConfirmDialog from "@/components/ConfirmDialog"
import { useAuth } from "@/context/AuthContext"
import { getSRSKey, generateAESKey, encryptFile, wrapKey } from "@/utils/crypto"
import FileDetailsDialog from "@/components/FileDetailsDialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import SEO from "@/components/SEO"
import { getUploadPolicyPreview } from "@/utils/policy"

interface FileItem {
  filename: string
  enc_filename?: string
  policy: string | null
  owner: string | null
  iv?: string
  key_blob?: string
  date?: number
  size?: number
  algorithm?: string
  revoked_users?: string[]
  can_restore_full?: boolean
}

interface ApiResponse {
  success: boolean
  data: {
    files: FileItem[]
  } | null
  error: string | null
}

interface UploadResponse {
  success: boolean
  data: {
    filename: string
    policy: string
    iv?: string
    key_blob?: string
    algorithm?: string
  } | null
  status?: string // Legacy support
  error?: string
}

interface RevokeResponse {
  success: boolean
  data: {
    status: string
  } | null
  error?: string
}

interface GrantResponse {
  success: boolean
  data: { status?: string } | null
  error?: string
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default function PatientFiles() {
  const { userId } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [uploading, setUploading] = useState(false)
  const [globalPolicy, setGlobalPolicy] = useState("Role:Doctor")
  /** Latest policy string — updated synchronously so upload never sends a stale preset. */
  const globalPolicyRef = useRef<string>("Role:Doctor")

  const updateGlobalPolicy = useCallback((value: string) => {
    globalPolicyRef.current = value
    setGlobalPolicy(value)
  }, [])
  // Revoke state
  const [revokeDialog, setRevokeDialog] = useState<{
    open: boolean
    filename: string | null
  }>({ open: false, filename: null })
  const [revoking, setRevoking] = useState(false)
  const [revokeUserId, setRevokeUserId] = useState("")
  const [grantUserDialog, setGrantUserDialog] = useState<{
    open: boolean
    filename: string | null
  }>({ open: false, filename: null })
  const [grantUserId, setGrantUserId] = useState("")
  const [granting, setGranting] = useState(false)
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean
    filename: string | null
    needsManualPolicy: boolean
  }>({ open: false, filename: null, needsManualPolicy: false })
  const [restorePolicyInput, setRestorePolicyInput] = useState("Role:Doctor")
  const [restoring, setRestoring] = useState(false)

  // Details Dialog State
  const [selectedFileDetails, setSelectedFileDetails] = useState<FileItem | null>(null)

  const normalizeFilename = (name: string) => {
    return name.replace(/\.enc$/, "").replace(/\.json$/, "")
  }

  const fetchFiles = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get<ApiResponse>("/patient/files")

      if (response.data.success && response.data.data?.files) {
        // Backend returns normalized filenames and nullable attributes.
        const fileList = response.data.data.files.map((file) => ({
          filename: file.filename,
          enc_filename: file.enc_filename,
          owner: file.owner || null,
          date: file.date,
          size: file.size,
          policy: file.policy || null,
          iv: file.iv || "N/A",
          key_blob: file.key_blob || "N/A",
          algorithm: file.algorithm || "AES-GCM-256 + RSA-OAEP",
          revoked_users: file.revoked_users ?? [],
          can_restore_full: Boolean(file.can_restore_full),
        }))
        setFiles(fileList)
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

  useEffect(() => {
    fetchFiles()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleRevokeClick = (filename: string) => {
    setRevokeDialog({ open: true, filename })
    setRevokeUserId("")
  }

  const handleRevokeConfirm = async () => {
    if (!revokeDialog.filename) return

    try {
      setRevoking(true)

      const payload: any = { filename: revokeDialog.filename }
      if (revokeUserId.trim()) {
        payload.revoke_user_id = revokeUserId.trim()
      }

      const response = await api.post<RevokeResponse>("/patient/revoke", payload)

      // Handle standardized API response format: { success: true, data: { status: "revoked" } }
      const status = response.data.data?.status

      if (response.data.success || status === "revoked") {
        toast.success("Access revoked successfully!")
        setRevokeDialog({ open: false, filename: null })
        await fetchFiles()
      } else {
        toast.error(response.data.error || "Failed to revoke access")
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to revoke access"
      )
    } finally {
      setRevoking(false)
    }
  }

  const handleRevokeCancel = () => {
    setRevokeDialog({ open: false, filename: null })
    setRevokeUserId("")
  }

  const handleGrantUserClick = (filename: string) => {
    setGrantUserDialog({ open: true, filename })
    setGrantUserId("")
  }

  const handleGrantUserConfirm = async () => {
    if (!grantUserDialog.filename) return
    if (!grantUserId.trim()) {
      toast.error("Enter the doctor user ID to un-block.")
      return
    }
    try {
      setGranting(true)
      const response = await api.post<GrantResponse>("/patient/grant", {
        filename: grantUserDialog.filename,
        grant_user_id: grantUserId.trim(),
      })
      if (response.data.success) {
        toast.success("Access restored for that user.")
        setGrantUserDialog({ open: false, filename: null })
        await fetchFiles()
      } else {
        toast.error(response.data.error || "Failed to restore access")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to restore access")
    } finally {
      setGranting(false)
    }
  }

  const handleRestoreFullClick = (file: FileItem) => {
    const needsManualPolicy =
      Boolean(file.policy?.includes("__REVOKED__") || file.policy?.includes("REVOKED")) &&
      !file.can_restore_full
    setRestoreDialog({
      open: true,
      filename: file.filename,
      needsManualPolicy,
    })
    setRestorePolicyInput("Role:Doctor")
  }

  const handleRestoreFullConfirm = async () => {
    if (!restoreDialog.filename) return
    try {
      setRestoring(true)
      const payload: Record<string, unknown> = {
        filename: restoreDialog.filename,
        restore_full: true,
      }
      if (restoreDialog.needsManualPolicy) {
        if (!restorePolicyInput.trim()) {
          toast.error("Enter a policy (e.g. Role:Doctor)")
          return
        }
        payload.policy = restorePolicyInput.trim()
      }
      const response = await api.post<GrantResponse>("/patient/grant", payload)
      if (response.data.success) {
        toast.success("Access restored. Doctors matching the policy can open this record again.")
        setRestoreDialog({ open: false, filename: null, needsManualPolicy: false })
        await fetchFiles()
      } else {
        toast.error(response.data.error || "Failed to restore")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to restore")
    } finally {
      setRestoring(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) {
      toast.error("Please select a file to upload")
      return
    }

    try {
      setUploading(true)

      // 1. Fetch SRS Public Key
      const srsKey = await getSRSKey()

      // 2. Generate AES Key
      const aesKey = await generateAESKey()

      // 3. Encrypt File
      const { encryptedBlob, iv } = await encryptFile(selectedFile, aesKey)

      // 4. Wrap AES Key
      const wrappedKey = await wrapKey(aesKey, srsKey)

      // 5. Upload
      const formData = new FormData()
      formData.append("file", encryptedBlob, `${selectedFile.name}.enc`)
      const policyToStore = globalPolicyRef.current.trim()
      formData.append("policy", policyToStore)
      formData.append("key_blob", wrappedKey)
      formData.append("iv", iv)
      formData.append("portions", JSON.stringify([]))

      const response = await api.post<UploadResponse>("/patient/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      // Safe Optimistic Update: Wait for backend response data
      if (response.data.success && response.data.data) {
        toast.success(
          "Encrypted in your browser and stored on the server as ciphertext only."
        )

        // Add new file to list using BACKEND returned data
        const newFile: FileItem = {
          filename: response.data.data.filename, // Use normalized name from backend
          policy: response.data.data.policy,     // Use canonical policy from backend
          owner: userId || "You",                // We know we are the owner
          iv: response.data.data.iv || "N/A",
          key_blob: response.data.data.key_blob || "N/A",
          algorithm: response.data.data.algorithm || "AES-GCM-256 + RSA-OAEP",
        }

        setFiles(prev => [newFile, ...prev])

        // Reset form
        setSelectedFile(null)
        const fileInput = document.getElementById("file-input") as HTMLInputElement
        if (fileInput) fileInput.value = ""

      } else {
        toast.error(response.data.error || "Upload failed")
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to upload file"
      )
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SEO
          title="My Health Records - SeSPHR"
          description="View and upload your Personal Health Records."
        />
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-slate-900">My Health Records</h1>
          <p className="text-slate-600 mt-1">
            View and upload your Personal Health Records
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Upload Health Record</CardTitle>
              <CardDescription>
                Upload a file and specify an access policy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-[80px] w-full" />
                </div>
                <Skeleton className="h-10 w-[120px]" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-[100px]" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-[80px] rounded-md" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-[100px]" />
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
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <SEO
        title="My Health Records - SeSPHR"
        description="View and upload your Personal Health Records."
      />
      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        open={revokeDialog.open}
        title="Revoke Access"
        description={`Are you sure you want to revoke access to "${revokeDialog.filename}"? This will prevent doctors from accessing this file.`}
        confirmText="Revoke Access"
        cancelText="Cancel"
        onConfirm={handleRevokeConfirm}
        onCancel={handleRevokeCancel}
        variant="destructive"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Revoke Specific User (Optional)
          </label>
          <Input
            placeholder="Enter Doctor User ID to block (e.g. 550e84...)"
            value={revokeUserId}
            onChange={(e) => setRevokeUserId(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-slate-500">
            Leave empty to revoke access for EVERYONE (Full Revocation).
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={grantUserDialog.open}
        title="Restore access for a user"
        description={`Remove a doctor user ID from the block list for "${grantUserDialog.filename ?? ""}".`}
        confirmText={granting ? "Restoring…" : "Restore access"}
        cancelText="Cancel"
        onConfirm={handleGrantUserConfirm}
        onCancel={() => !granting && setGrantUserDialog({ open: false, filename: null })}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Doctor user ID</label>
          <Input
            placeholder="Same UUID you used when revoking this user"
            value={grantUserId}
            onChange={(e) => setGrantUserId(e.target.value)}
            className="text-sm"
            disabled={granting}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={restoreDialog.open}
        title="Restore full access"
        description={
          restoreDialog.needsManualPolicy
            ? "This record was revoked before one-click restore was available. Enter the access policy to apply (e.g. Role:Doctor)."
            : "Restore the access policy from before full revocation. All user-specific blocks for this file will be cleared."
        }
        confirmText={restoring ? "Restoring…" : "Restore access"}
        cancelText="Cancel"
        onConfirm={handleRestoreFullConfirm}
        onCancel={() => !restoring && setRestoreDialog({ open: false, filename: null, needsManualPolicy: false })}
      >
        {restoreDialog.needsManualPolicy && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Access policy</label>
            <Input
              value={restorePolicyInput}
              onChange={(e) => setRestorePolicyInput(e.target.value)}
              placeholder="Role:Doctor"
              disabled={restoring}
            />
          </div>
        )}
      </ConfirmDialog>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-slate-900">My Health Records</h1>
        <p className="text-slate-600 mt-1">
          View and upload your Personal Health Records
        </p>
      </motion.div>

      {/* Upload Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Upload Health Record</CardTitle>
            <CardDescription>
              Upload ciphertext only. Who can <strong>decrypt</strong> is controlled by the access policy below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="file-input" className="text-sm font-medium text-slate-700">
                  File
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                    disabled={uploading}
                  />
                  {selectedFile && (
                    <span className="text-sm text-slate-600">
                      {selectedFile.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  File Access Policy
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Only users whose attributes match this policy receive decryption keys. Use a preset or type a custom expression.
                </p>
                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "All Doctors", value: "Role:Doctor" },
                    { label: "Cardiology only", value: "Role:Doctor AND Dept:Cardiology" },
                    { label: "Orthopedics only", value: "Role:Doctor AND Dept:Orthopedics" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => updateGlobalPolicy(preset.value)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        globalPolicy === preset.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  value={globalPolicy}
                  onChange={(e) => updateGlobalPolicy(e.target.value)}
                  placeholder="e.g. Role:Doctor AND Dept:Cardiology"
                />
                {/* Live access preview */}
                {(() => {
                  const preview = getUploadPolicyPreview(globalPolicy)
                  const isDept = preview.kind === "department"
                  const isAllDocs = preview.kind === "all_doctors"
                  return (
                    <div
                      className={`flex flex-col gap-2 px-3 py-2 rounded-md text-xs border ${
                        isDept
                          ? "bg-green-50 border-green-200 text-green-900"
                          : isAllDocs
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          {preview.kind === "department" && (
                            <>
                              <p className="font-semibold">
                                Decryptable only by: doctors in {preview.department}
                              </p>
                              <p className="text-[11px] opacity-90">
                                Other departments will not receive keys for this file (unless a matching section-level policy applies).
                              </p>
                            </>
                          )}
                          {preview.kind === "all_doctors" && (
                            <>
                              <p className="font-semibold flex flex-wrap items-center gap-2">
                                Decryptable by: all doctors
                                <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100/80 text-amber-900">
                                  All departments
                                </Badge>
                              </p>
                              <p className="text-[11px] opacity-90">
                                Any doctor account whose attributes satisfy <code className="px-0.5 bg-white/70 rounded">Role:Doctor</code> can request decryption keys.
                              </p>
                            </>
                          )}
                          {preview.kind === "admin" && (
                            <p className="font-semibold">Decryptable only by users matching Role:Admin.</p>
                          )}
                          {preview.kind === "custom" && (
                            <p>
                              <span className="font-semibold">Custom policy.</span>{" "}
                              Only users whose attributes match this expression receive keys:{" "}
                              <code className="bg-white/80 px-1 rounded break-all">{globalPolicy.trim() || "—"}</code>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>


              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={uploading || !selectedFile}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Encrypting & Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Secure Upload
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Files List */}
      <AnimatePresence mode="wait">
        {files.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No files found
                </h3>
                <p className="text-sm text-slate-600">
                  Upload your first Personal Health Record above.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="files"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>
                  {files.length} {files.length === 1 ? "file" : "files"} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-auto">File Name</TableHead>
                      <TableHead className="w-[120px]">Date</TableHead>
                      <TableHead className="w-[150px]">Policy</TableHead>
                      <TableHead className="w-[100px]">Owner</TableHead>
                      <TableHead className="w-[100px]">Size</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file, index) => {
                      const pol = file.policy || ""
                      const isFullRevoked =
                        pol.includes("__REVOKED__") ||
                        pol.toLowerCase().includes("revoked")
                      const blockedUsers = file.revoked_users?.length ?? 0
                      const cleanFilename = normalizeFilename(file.filename)
                      const showRestoreFull = isFullRevoked
                      const showUnblockUser = blockedUsers > 0 && !isFullRevoked

                      return (
                        <MotionTableRow
                          key={`${file.filename}-${file.policy}-${blockedUsers}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05, duration: 0.3 }}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              {cleanFilename}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {file.date ? new Date(file.date * 1000).toLocaleDateString("en-US", {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : "—"}
                          </TableCell>
                          <TableCell>
                            <motion.span
                              key={file.policy}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                              title={file.policy || undefined}
                              className={`px-2 py-1 rounded-md text-xs font-medium truncate max-w-[140px] block ${isFullRevoked
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                            >
                              {isFullRevoked
                                ? "Revoked (all)"
                                : blockedUsers > 0
                                  ? `${blockedUsers} blocked`
                                  : file.policy || "N/A"}
                            </motion.span>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {file.owner === userId ? "You" : (file.owner || "Unknown")}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {file.size ? formatBytes(file.size) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedFileDetails(file)}
                                className="h-8 w-8 p-0"
                              >
                                <Info className="w-4 h-4 text-slate-400" />
                              </Button>
                              {showRestoreFull && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                  disabled={restoring}
                                  onClick={() => handleRestoreFullClick(file)}
                                >
                                  <Unlock className="w-3 h-3" />
                                  Restore
                                </Button>
                              )}
                              {showUnblockUser && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 border-emerald-300 text-emerald-800"
                                  disabled={granting}
                                  onClick={() => handleGrantUserClick(file.filename)}
                                >
                                  <Unlock className="w-3 h-3" />
                                  Un-block user
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeClick(file.filename)}
                                disabled={revoking || revokeDialog.filename === file.filename || isFullRevoked}
                                className="gap-2 h-8 px-3"
                              >
                                {revoking && revokeDialog.filename === file.filename ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Revoking...
                                  </>
                                ) : (
                                  <>
                                    <ShieldX className="w-3 h-3" />
                                    Revoke
                                  </>
                                )}
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
        )}
      </AnimatePresence>

      <FileDetailsDialog
        open={!!selectedFileDetails}
        onOpenChange={(open) => !open && setSelectedFileDetails(null)}
        file={selectedFileDetails}
      />
    </div>
  )
}

