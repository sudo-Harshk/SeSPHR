import type { ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "react-router-dom"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"
import Footer from "@/components/layout/Footer"
import SEO from "@/components/SEO"

type Role = "patient" | "doctor" | "admin"

interface DashboardLayoutProps {
  role: Role
  user: string
  children: ReactNode
}

export default function DashboardLayout({ role, user, children }: DashboardLayoutProps) {
  const location = useLocation()

  const formattedRole = role.charAt(0).toUpperCase() + role.slice(1)

  return (
    <div className="flex min-h-screen bg-slate-100">
      <SEO
        title={`${formattedRole} Dashboard - SeSPHR`}
        description={`Secure ${role} dashboard for SeSPHR health records system.`}
      />
      <Sidebar role={role} />

      <div className="flex-1 flex flex-col">
        <Topbar user={user} />

        <main className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </div>
  )
}

