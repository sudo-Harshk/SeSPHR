import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import DashboardLayout from "@/layouts/DashboardLayout"
import ProtectedRoute from "@/components/ProtectedRoute"
import RoleRoute from "@/components/RoleRoute"

import Login from "@/pages/Login"
import Signup from "@/pages/Signup"
import PatientDashboard from "@/pages/patient/PatientDashboard"
import PatientFiles from "@/pages/patient/PatientFiles"
import DoctorDashboard from "@/pages/doctor/DoctorDashboard"
import DoctorFiles from "@/pages/doctor/DoctorFiles"
import AdminDashboard from "@/pages/admin/AdminDashboard"
import AdminAuditLogs from "@/pages/admin/AdminAuditLogs"
import AdminUsers from "@/pages/admin/AdminUsers"
import Landing from "@/pages/Landing"

import { Toaster } from "sonner"

export default function App() {
  const auth = useAuth()

  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Landing />} />

        <Route
          path="/patient"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["patient"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <PatientDashboard />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/files"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["patient"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <PatientFiles />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["doctor"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <DoctorDashboard />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/files"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["doctor"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <DoctorFiles />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["admin"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <AdminDashboard />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["admin"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <AdminAuditLogs />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["admin"]}>
                <DashboardLayout role={auth.role!} user={auth.userId!}>
                  <AdminUsers />
                </DashboardLayout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
