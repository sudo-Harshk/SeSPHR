import { useEffect, useState } from "react"
import { FileText, Upload, Shield, Loader2, ArrowRight } from "lucide-react"
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

export default function PatientDashboard() {
  const navigate = useNavigate()
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<ApiResponse>("/patient/files")
        if (response.data.success && response.data.data?.files) {
          setFileCount(response.data.data.files.length)
        }
      } catch (err) {
        // Silently handle errors - show 0 if API fails
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
        <h1 className="text-3xl font-bold text-slate-900">Patient Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Manage your Personal Health Records and control access policies
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
                Total Files
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
                Encrypted health records stored
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
                Upload New Record
              </CardTitle>
              <Upload className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Upload and encrypt your health records with fine-grained access policies
              </p>
              <Button
                onClick={() => navigate("/patient/files")}
                className="w-full"
                variant="default"
              >
                Go to Files
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
                Access Control
              </CardTitle>
              <Shield className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Manage access policies and revoke permissions for your health records
              </p>
              <Button
                onClick={() => navigate("/patient/files")}
                className="w-full"
                variant="outline"
              >
                Manage Access
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks for managing your health records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate("/patient/files")}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload New File
              </Button>
              <Button
                onClick={() => navigate("/patient/files")}
                variant="outline"
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                View All Files
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
