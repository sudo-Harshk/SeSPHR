import type { ReactNode } from "react"
import { useAuth } from "@/context/AuthContext"
import AccessDenied from "@/pages/AccessDenied"

type Role = "patient" | "doctor" | "admin"

interface RoleRouteProps {
  allowedRoles: Role[]
  children: ReactNode
}

export default function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const auth = useAuth()

  // Show loading state while auth is being checked
  // This should not happen if wrapped by ProtectedRoute, but safety check
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  // Show access denied if user is not authenticated
  // This should not happen if wrapped by ProtectedRoute, but safety check
  if (!auth.authenticated) {
    return <AccessDenied />
  }

  // Show access denied if user role is not in allowed roles
  if (!auth.role || !allowedRoles.includes(auth.role)) {
    return <AccessDenied />
  }

  // Render children if role is allowed
  return <>{children}</>
}

