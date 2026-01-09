import { useEffect, useState } from "react"
import { FileText, Shield, Download, Loader2, ArrowRight, CheckCircle2, XCircle } from "lucide-react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import api from "@/services/api"

interface ApiResponse {
  success: boolean
  data: {
    files: string[]
  } | null
  error: string | null
}

export default function DoctorDashboard() {
  const navigate = useNavigate()
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<ApiResponse>("/doctor/files")
        if (response.data.success && response.data.data?.files) {
          setFileCount(response.data.data.files.length)
        }
      } catch (err) {
        setFileCount(0)
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
        <h1 className="text-3xl font-bold text-slate-900">Doctor Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Access and manage patient health records with secure, policy-based access control
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Available Files
              </CardTitle>
              <FileText className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  fileCount ?? 0
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Encrypted health records available
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
                Access Control
              </CardTitle>
              <Shield className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Request access to patient records based on your attributes and role
              </p>
              <Button
                onClick={() => navigate("/doctor/files")}
                className="w-full"
                variant="default"
              >
                Request Access
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
                Secure Download
              </CardTitle>
              <Download className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Download decrypted records only after access is granted
              </p>
              <Button
                onClick={() => navigate("/doctor/files")}
                className="w-full"
                variant="outline"
              >
                View Files
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Access Workflow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Access Workflow</CardTitle>
            <CardDescription>
              How to access patient health records securely
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-semibold text-blue-600">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Browse Available Files</p>
                  <p className="text-sm text-slate-600">
                    View all encrypted health records stored in the system
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                  <span className="text-sm font-semibold text-yellow-600">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Request Access</p>
                  <p className="text-sm text-slate-600">
                    System checks your attributes against the file's access policy
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Access Granted</p>
                  <p className="text-sm text-slate-600">
                    If your attributes match, you can securely download and decrypt the file
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Access Denied</p>
                  <p className="text-sm text-slate-600">
                    If your attributes don't match the policy, access is denied with a reason
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="mt-6">
              <Button
                onClick={() => navigate("/doctor/files")}
                className="w-full"
                size="lg"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
