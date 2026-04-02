import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import api from "@/services/api"

type Role = "patient" | "doctor" | "admin" | null

interface AuthContextType {
  authenticated: boolean
  userId: string | null
  role: Role
  attributes: Record<string, string>
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
  const [attributes, setAttributes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get("/session")
      .then(res => {
        // Handle new API response format: { success, data: { authenticated, user_id, role, attributes, ... }, error }
        const data = res.data.data
        if (res.data.success && data?.user_id) {
          setAuthenticated(true)
          setUserId(data.user_id)
          setRole(data.role)
          setAttributes(data.attributes || {})
        } else {
          setAuthenticated(false)
          setUserId(null)
          setRole(null)
          setAttributes({})
        }
      })
      .catch((error) => {
        // Only clear session on 401/403 (unauthorized/forbidden)
        if (error.response?.status === 401 || error.response?.status === 403) {
          setAuthenticated(false)
          setUserId(null)
          setRole(null)
          setAttributes({})
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
      setUserId(response.data.data.user)
      setRole(response.data.data.role)
      
      // Fetch session to get attributes after login
      try {
        const sessionRes = await api.get("/session")
        if (sessionRes.data.success && sessionRes.data.data?.attributes) {
          setAttributes(sessionRes.data.data.attributes)
        }
      } catch (e) {
        console.error("Failed to fetch attributes after login", e)
      }
    } else {
      throw new Error(response.data.error || "Login failed")
    }
  }

  const logout = async () => {
    await api.post("/logout")
    setAuthenticated(false)
    setUserId(null)
    setRole(null)
    setAttributes({})
  }

  return (
    <AuthContext.Provider value={{ authenticated, userId, role, attributes, login, logout, loading }}>
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

