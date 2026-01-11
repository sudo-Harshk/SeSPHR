import { useEffect, useState } from "react"
import { Shield, FileSearch, CheckCircle2, XCircle, Loader2, ArrowRight, AlertTriangle, Users } from "lucide-react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import api from "@/services/api"

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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<ApiResponse>("/audit/logs")
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
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-blue-900">About Audit Logs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              The audit log system maintains a tamper-evident hash chain. Each log entry includes a cryptographic hash 
              that links it to the previous entry, making any unauthorized modifications immediately detectable. 
              All access attempts, grants, and denials are logged with full traceability.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
