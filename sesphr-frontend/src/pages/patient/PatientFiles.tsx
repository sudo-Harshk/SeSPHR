import { useEffect, useState } from "react"
import { FileText, Loader2, Upload, CheckCircle2, ShieldX } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import PolicyBuilder from "@/components/PolicyBuilder"
import ConfirmDialog from "@/components/ConfirmDialog"
import { useAuth } from "@/context/AuthContext"
import { getSRSKey, generateAESKey, encryptFile, wrapKey } from "@/utils/crypto"

interface FileItem {
  filename: string
  // enc_filename is strictly internal now, but kept if UI needs it for debug.
  // Backend contract says: { filename, owner, policy }
  // We keep it optional just in case.
  enc_filename?: string
  policy: string | null
  owner: string | null
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

export default function PatientFiles() {
  const { userId } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [policy, setPolicy] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Revoke state
  const [revokeDialog, setRevokeDialog] = useState<{
    open: boolean
    filename: string | null
  }>({ open: false, filename: null })
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [revokeSuccess, setRevokeSuccess] = useState(false)

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
          policy: file.policy || null,
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
      setUploadError(null)
      setUploadSuccess(false)
    }
  }

  const handleRevokeClick = (filename: string) => {
    setRevokeDialog({ open: true, filename })
    setRevokeError(null)
    setRevokeSuccess(false)
  }

  const handleRevokeConfirm = async () => {
    if (!revokeDialog.filename) return

    try {
      setRevoking(true)
      setRevokeError(null)
      setRevokeSuccess(false)

      const response = await api.post<RevokeResponse>("/patient/revoke", {
        filename: revokeDialog.filename,
      })

      // Handle standardized API response format: { success: true, data: { status: "revoked" } }
      const status = response.data.data?.status

      if (response.data.success || status === "revoked") {
        setRevokeSuccess(true)
        setRevokeDialog({ open: false, filename: null })

        // Optimistic Update: Mark as revoked immediately based on success
        setFiles(prevFiles => prevFiles.map(f =>
          f.filename === revokeDialog.filename
            ? { ...f, policy: "Role:__REVOKED__" }
            : f
        ))

        // Reset success message after delay
        setTimeout(() => {
          setRevokeSuccess(false)
        }, 3000)
      } else {
        setRevokeError(response.data.error || "Failed to revoke access")
      }
    } catch (err: any) {
      setRevokeError(
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
    setRevokeError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile || !policy.trim()) {
      setUploadError("Please select a file and enter a policy")
      return
    }

    try {
      setUploading(true)
      setUploadError(null)
      setUploadSuccess(false)

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
      // Append encrypted blob with .enc extension to indicate it's encrypted
      formData.append("file", encryptedBlob, `${selectedFile.name}.enc`)
      formData.append("policy", policy.trim())
      formData.append("key_blob", wrappedKey)
      formData.append("iv", iv)

      const response = await api.post<UploadResponse>("/patient/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      // Safe Optimistic Update: Wait for backend response data
      if (response.data.success && response.data.data) {
        setUploadSuccess(true)

        // Add new file to list using BACKEND returned data
        const newFile: FileItem = {
          filename: response.data.data.filename, // Use normalized name from backend
          policy: response.data.data.policy,     // Use canonical policy from backend
          owner: userId || "You",                // We know we are the owner
        }

        setFiles(prev => [newFile, ...prev])

        // Reset form
        setSelectedFile(null)
        setPolicy("")
        const fileInput = document.getElementById("file-input") as HTMLInputElement
        if (fileInput) fileInput.value = ""

        // Reset success message after delay
        setTimeout(() => {
          setUploadSuccess(false)
        }, 3000)
      } else {
        setUploadError(response.data.error || "Upload failed")
      }
    } catch (err: any) {
      setUploadError(
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-slate-600">Loading files...</p>
        </div>
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
      {/* Revoke Success Message */}
      <AnimatePresence>
        {revokeSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-600">Access revoked successfully!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revoke Error Message */}
      <AnimatePresence>
        {revokeError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="p-3 bg-red-50 border border-red-200 rounded-md"
          >
            <p className="text-sm text-red-600">{revokeError}</p>
          </motion.div>
        )}
      </AnimatePresence>

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
              Upload a file and specify an access policy
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
                <label className="text-sm font-medium text-slate-700">
                  Access Policy
                </label>
                <PolicyBuilder
                  value={policy}
                  onChange={(newPolicy) => {
                    setPolicy(newPolicy)
                    setUploadError(null)
                    setUploadSuccess(false)
                  }}
                />
                <p className="text-xs text-slate-500">
                  Build an access policy by selecting attributes and values
                </p>
              </div>

              <AnimatePresence>
                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-md"
                  >
                    <p className="text-sm text-red-600">{uploadError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {uploadSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-600">File uploaded successfully!</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button type="submit" disabled={uploading || !selectedFile || !policy.trim()}>
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
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
                      <TableHead>File Name</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file, index) => {
                      const isRevoked = file.policy?.includes("REVOKED") || file.policy?.includes("Revoked");
                      const cleanFilename = normalizeFilename(file.filename);

                      return (
                        <MotionTableRow
                          key={`${file.filename}-${file.policy}`}
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
                          <TableCell>
                            <motion.span
                              key={file.policy}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                              className={`px-2 py-1 rounded-md text-xs font-medium ${isRevoked
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                                }`}
                            >
                              {file.policy || "N/A"}
                            </motion.span>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {file.owner === userId ? "You" : (file.owner || "Unknown")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRevokeClick(file.filename)}
                              disabled={revoking || revokeDialog.filename === file.filename || !!isRevoked}
                              className={`gap-2 ${isRevoked ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              {revoking && revokeDialog.filename === file.filename ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Revoking...
                                </>
                              ) : (
                                <>
                                  <ShieldX className="w-3 h-3" />
                                  {isRevoked ? "Revoked" : "Revoke Access"}
                                </>
                              )}
                            </Button>
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
    </div>
  )
}

