import { ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"

export default function AccessDenied() {
  const auth = useAuth()
  const navigate = useNavigate()

  const handleGoBack = () => {
    // Navigate to user's dashboard based on their role
    if (auth.role) {
      navigate(`/${auth.role}`)
    } else {
      navigate("/login")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center space-y-4">
        <ShieldX className="w-16 h-16 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-slate-600">
          You don't have permission to access this page.
        </p>
        {auth.role && (
          <Button onClick={handleGoBack}>
            Go to {auth.role.charAt(0).toUpperCase() + auth.role.slice(1)} Dashboard
          </Button>
        )}
      </div>
    </div>
  )
}

