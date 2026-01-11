import { useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/AuthContext"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import ConfirmDialog from "@/components/ConfirmDialog"

interface TopbarProps {
  user: string
}

const roleColors: Record<"patient" | "doctor" | "admin", string> = {
  patient: "bg-blue-100 text-blue-800 border-blue-200",
  doctor: "bg-green-100 text-green-800 border-green-200",
  admin: "bg-purple-100 text-purple-800 border-purple-200",
}

export default function Topbar({ user }: TopbarProps) {
  const { logout, role } = useAuth()
  const navigate = useNavigate()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  const roleLabel = role 
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : ""

  return (
    <motion.div 
      className="h-14 bg-white border-b flex items-center justify-between px-6 shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-700 font-medium">
          {user}
        </span>
        {role && (
          <Badge 
            variant="outline" 
            className={`${roleColors[role]} border`}
          >
            {roleLabel}
          </Badge>
        )}
      </div>

      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setShowLogoutDialog(true)}
        className="gap-2"
      >
        <LogOut size={16} />
        Logout
      </Button>

      <ConfirmDialog
        open={showLogoutDialog}
        title="Confirm Logout"
        description="Are you sure you want to logout? You will need to login again to access your account."
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutDialog(false)}
        variant="default"
      />
    </motion.div>
  )
}

