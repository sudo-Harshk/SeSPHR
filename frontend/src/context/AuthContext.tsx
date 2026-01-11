import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import api from "@/services/api"

type Role = "patient" | "doctor" | "admin" | null

interface AuthContextType {
  authenticated: boolean
  userId: string | null
  role: Role
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get("/session")
      .then(res => {
        // Handle new API response format: { success, data: { authenticated, user_id, role, ... }, error }
        // Note: Backend returns 'user_id', checking if we need to map high-level or deep
        const data = res.data.data
        if (res.data.success && data?.user_id) {
          setAuthenticated(true)
          setUserId(data.user_id)
          setRole(data.role)
        } else {
          setAuthenticated(false)
          setUserId(null)
          setRole(null)
        }
      })
      .catch((error) => {
        // Only clear session on 401/403 (unauthorized/forbidden)
        if (error.response?.status === 401 || error.response?.status === 403) {
          setAuthenticated(false)
          setUserId(null)
          setRole(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    // Backend expects { email, password }
    const response = await api.post("/login", { email, password })

    // Response contract: { success: true, data: { user: <uuid>, role: <role> } }
    if (response.data.success && response.data.data) {
      setAuthenticated(true)
      setUserId(response.data.data.user) // Backend currently returns 'user' in login response for UUID
      setRole(response.data.data.role)
    } else {
      throw new Error(response.data.error || "Login failed")
    }
  }

  const logout = async () => {
    await api.post("/logout")
    setAuthenticated(false)
    setUserId(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ authenticated, userId, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

