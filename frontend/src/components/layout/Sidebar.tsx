import { NavLink } from "react-router-dom"
import { LayoutDashboard, FileText, FolderOpen, Shield, FileSearch } from "lucide-react" // Added icons
import { motion } from "framer-motion"

const links = {
  patient: [
    { to: "/patient", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patient/files", label: "My Files", icon: FileText },
  ],
  doctor: [
    { to: "/doctor", label: "Dashboard", icon: LayoutDashboard },
    { to: "/doctor/files", label: "Files", icon: FolderOpen },
  ],
  admin: [
    { to: "/admin", label: "Admin Panel", icon: Shield },
    { to: "/admin/audit", label: "Audit Logs", icon: FileSearch },
  ],
}

type Role = "patient" | "doctor" | "admin"

interface SidebarProps {
  role: Role
}

export default function Sidebar({ role }: SidebarProps) {


  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col p-4">
      <motion.h2
        className="text-xl font-bold mb-6"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        SeSPHR
      </motion.h2>

      <nav className="space-y-1 flex-1">
        {links[role]?.map(({ to, label, icon: Icon }, index) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <NavLink
              end
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              <span className="font-medium">{label}</span>
            </NavLink>
          </motion.div>
        ))}
      </nav>


    </div>
  )
}

