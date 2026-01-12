import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Users,
  Key,
  Loader2,
  AlertCircle,
} from "lucide-react"
import api from "@/services/api"

interface User {
  user_id: string
  role: string | null
  attributes: Record<string, string>
}

interface ApiResponse {
  success: boolean
  data: {
    users: User[]
  } | null
  error: string | null
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  // Add attribute form state


  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get<ApiResponse>("/admin/users")

      if (response.data.success && response.data.data?.users) {
        setUsers(response.data.data.users)
      } else {
        setError(response.data.error || "Failed to load users")
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch users")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-slate-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-600 mt-2">
          Manage users and assign attributes for CP-ABE policy evaluation
        </p>
      </motion.div>



      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Users ({users.length})
                </CardTitle>
                <CardDescription>
                  View and manage user attributes for access control policies
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No users found
                </h3>
                <p className="text-sm text-slate-600">
                  Users will appear here after they sign up.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Attributes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, index) => (
                      <motion.tr
                        key={user.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        className="border-b"
                      >
                        <TableCell className="font-medium">{user.user_id}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(user.attributes).length === 0 ? (
                              <span className="text-sm text-slate-400">No attributes</span>
                            ) : (
                              Object.entries(user.attributes).map(([key, value]) => (
                                <motion.span
                                  key={`${key}:${value}`}
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.2 }}
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 flex items-center gap-1"
                                >
                                  <Key className="w-3 h-3" />
                                  {key}: {value}
                                </motion.span>
                              ))
                            )}
                          </div>
                        </TableCell>

                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Attributes Detail Cards */}
      {
        users.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {users.map((user, userIndex) => (
              <motion.div
                key={user.user_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + userIndex * 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{user.user_id}</CardTitle>
                    <CardDescription>
                      {Object.keys(user.attributes).length} attribute
                      {Object.keys(user.attributes).length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(user.attributes).length === 0 ? (
                      <p className="text-sm text-slate-500">No attributes assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(user.attributes).map(([key, value], attrIndex) => (
                          <motion.div
                            key={`${key}:${value}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: attrIndex * 0.05 }}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-md"
                          >
                            <div className="flex items-center gap-2">
                              <Key className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-900">
                                {key}: <span className="text-slate-600">{value}</span>
                              </span>
                            </div>

                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )
      }
    </div >
  )
}

