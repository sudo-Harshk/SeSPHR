import { useEffect, useState } from "react"
import { Shield, FileSearch, CheckCircle2, XCircle, Loader2, ArrowRight, Users, Trash2, Cloud, ShieldCheck, ShieldX } from "lucide-react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import api from "@/services/api"
import ConfirmDialog from "@/components/ConfirmDialog"
import { toast } from "sonner"
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram"

interface AuditLogEntry {
  timestamp: number
  user: string
  file: string
  action: string
  status: string
  hash?: string
  prev_hash?: string
}

interface ApiResponse {
  success: boolean
  data: {
    logs: AuditLogEntry[]
  } | null
  error: string | null
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [logCount, setLogCount] = useState<number | null>(null)
  const [grantedCount, setGrantedCount] = useState(0)
  const [deniedCount, setDeniedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [clearUploadsOpen, setClearUploadsOpen] = useState(false)
  const [clearingUploads, setClearingUploads] = useState(false)

  const handleClearUploads = async () => {
    if (clearingUploads) return
    setClearingUploads(true)
    try {
      const response = await api.post("/debug/clear-uploads")
      if (response.data.success) {
        const d = response.data.data
        toast.success(
          `PHR storage cleared (${d?.removed_enc_files ?? 0} files, ${d?.removed_meta_files ?? 0} metadata). Users and keys unchanged.`
        )
        setClearUploadsOpen(false)
      } else {
        toast.error(response.data.error || "Clear failed")
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Request failed"
      toast.error(
        msg.includes("Debug") || err.response?.status === 403
          ? "Available only in development (FLASK_ENV=development)."
          : msg
      )
    } finally {
      setClearingUploads(false)
    }
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<ApiResponse>("/admin/audit")
        if (response.data.success && response.data.data?.logs) {
          const logs = response.data.data.logs
          setLogCount(logs.length)
          
          const granted = logs.filter(log => 
            log.status.toUpperCase() === "GRANTED" || 
            log.status.toUpperCase() === "SUCCESS"
          ).length
          const denied = logs.filter(log => 
            log.status.toUpperCase().startsWith("DENIED") ||
            log.status.toUpperCase() === "DENIED"
          ).length
          
          setGrantedCount(granted)
          setDeniedCount(denied)
        }
      } catch (err) {
        setLogCount(0)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.4,
      },
    }),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Monitor system activity, audit logs, and verify hash chain integrity
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Logs
              </CardTitle>
              <FileSearch className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  logCount ?? 0
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Audit log entries
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={1}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Granted
              </CardTitle>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  grantedCount
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Successful access grants
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={2}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Denied
              </CardTitle>
              <XCircle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  deniedCount
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Access denials
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Integrity
              </CardTitle>
              <Shield className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Hash chain status
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>System Monitoring</CardTitle>
            <CardDescription>
              View detailed audit logs and verify system integrity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <FileSearch className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Audit Logs</p>
                  <p className="text-sm text-slate-600 mb-3">
                    View all system access attempts, grants, and denials with timestamps and user information
                  </p>
                  <Button
                    onClick={() => navigate("/admin/audit")}
                    variant="default"
                    className="gap-2"
                  >
                    View Audit Logs
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Hash Chain Integrity</p>
                  <p className="text-sm text-slate-600 mb-3">
                    Verify cryptographic hash chain integrity to detect tampering or unauthorized modifications
                  </p>
                  <Button
                    onClick={() => navigate("/admin/audit")}
                    variant="outline"
                    className="gap-2"
                  >
                    Verify Integrity
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Users className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">User Management</p>
                  <p className="text-sm text-slate-600 mb-3">
                    Manage users and assign attributes for CP-ABE policy evaluation. Attributes determine which files users can access.
                  </p>
                  <Button
                    onClick={() => navigate("/admin/users")}
                    variant="default"
                    className="gap-2"
                  >
                    Manage Users
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Demo: clear PHR uploads</p>
                  <p className="text-sm text-slate-600 mb-3">
                    Removes all ciphertext and metadata from cloud storage so you can run a fresh upload → doctor view flow. Does not delete users, the database, SRS keys, or user RSA keys.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100"
                    onClick={() => setClearUploadsOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear uploads only
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <ConfirmDialog
        open={clearUploadsOpen}
        title="Clear all PHR uploads?"
        description="This deletes encrypted files (.enc) and JSON metadata from cloud storage. Accounts and cryptographic keys are kept. Use this to reset demos."
        confirmText={clearingUploads ? "Clearing…" : "Clear uploads"}
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleClearUploads}
        onCancel={() => !clearingUploads && setClearUploadsOpen(false)}
      />

      {/* Threat Model Box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Card className="border-slate-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-700" />
              <CardTitle className="text-slate-900">Threat Model</CardTitle>
            </div>
            <CardDescription>
              What this system protects — and what it does not.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                {[
                  "Untrusted cloud storage",
                  "Data breach at cloud provider",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-md bg-green-50 border border-green-200 px-3 py-2">
                    <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm text-green-800">
                      <span className="font-semibold">{item}</span>
                      <span className="text-green-700"> → Protected</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { threat: "Malicious SRS", reason: "SRS sees AES key in memory (trusted assumption)" },
                  { threat: "Network attacker (no TLS)", reason: "Transport security is a separate concern" },
                ].map((item) => (
                  <div
                    key={item.threat}
                    data-testid={item.threat === "Malicious SRS" ? "dashboard-threat-srs" : undefined}
                    className="flex items-start gap-3 rounded-md bg-red-50 border border-red-200 px-3 py-2"
                  >
                    <ShieldX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-semibold text-red-800">{item.threat}</span>
                      <span className="text-sm text-red-600"> → Not protected</span>
                      <p className="text-xs text-red-500 mt-0.5">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-900 text-white px-4 py-3 text-sm font-medium">
              To read data, an attacker must compromise <span className="text-amber-400 font-bold">BOTH Cloud AND SRS simultaneously.</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Architecture Diagram */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              <CardTitle>System Architecture</CardTitle>
            </div>
            <CardDescription>
              Trust levels: Browser (Trusted) → SRS (Semi-trusted, sees AES key in memory) → Cloud (Untrusted, sees only ciphertext)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-green-800 font-medium">
                Browser: Trusted — encrypt/decrypt happens here
              </span>
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-800 font-medium">
                SRS: Semi-trusted — sees AES key in memory (trusted assumption)
              </span>
              <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-red-800 font-medium">
                Cloud: Untrusted — sees only ciphertext
              </span>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <ArchitectureDiagram />
            </div>
            <p
              className="mt-2 text-center text-xs text-slate-500 font-medium"
              data-testid="dashboard-arch-decryption-browser"
            >
              Decryption happens only in browser — ciphertext never leaves the cloud unencrypted.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
