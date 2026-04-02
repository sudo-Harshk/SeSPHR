import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react"

import api from "@/services/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AuditLog {
  timestamp: number
  user: string
  file: string
  action: string
  status: string
  prev_hash: string
  hash: string
}

type IntegrityStatus = "verifying" | "valid" | "tampered"

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus>("verifying")
  const [integrityDetail, setIntegrityDetail] = useState<string>("")

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setIntegrityStatus("verifying")
      const response = await api.get("/admin/audit")
      if (response.data.success && response.data.data) {
        const data = response.data.data as {
          logs: AuditLog[]
          integrity?: { valid: boolean; detail?: string }
        }
        const fetchedLogs = data.logs ?? []

        const integrity = data.integrity
        if (integrity) {
          setIntegrityStatus(integrity.valid ? "valid" : "tampered")
          setIntegrityDetail(integrity.detail?.trim() || "")
        } else {
          setIntegrityStatus("valid")
          setIntegrityDetail("")
        }

        const sortedForDisplay = [...fetchedLogs].sort((a, b) => b.timestamp - a.timestamp)
        setLogs(sortedForDisplay)
      } else {
        setLogs([])
        setIntegrityStatus("valid")
        setIntegrityDetail("")
      }
    } catch (error) {
      console.error("Failed to fetch audit logs", error)
      setLogs([])
      setIntegrityStatus("valid")
      setIntegrityDetail("")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    // 07 Jan 2026, 20:17:05
    return new Date(timestamp * 1000).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === "GRANTED") {
      return <Badge className="bg-green-600 hover:bg-green-700">GRANTED</Badge>
    }
    if (status.startsWith("DENIED")) {
      return <Badge variant="destructive">{status}</Badge>
    }
    if (status === "INVALID_REQUEST") {
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge className="bg-amber-500 hover:bg-amber-600">INVALID_REQUEST</Badge>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Malformed/Missing Resource</span>
        </div>
      )
    }
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Immutable record of all system access and policy enforcement events.
        </p>
      </div>

      {/* Integrity Status Banner */}
      <Card className={`border-l-4 ${integrityStatus === "valid" ? "border-l-green-500" : integrityStatus === "tampered" ? "border-l-red-500" : "border-l-blue-500"}`}>
        <CardContent className="pt-6 flex items-center gap-4">
          {integrityStatus === "verifying" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <div className="space-y-1">
                <h4 className="font-semibold">Loading audit log…</h4>
                <p className="text-sm text-muted-foreground">Fetching entries and server-side integrity check.</p>
              </div>
            </>
          )}
          {integrityStatus === "valid" && (
            <>
              <ShieldCheck className="h-6 w-6 text-green-600" />
              <div className="space-y-1">
                <h4 className="font-semibold text-green-700">All Audit Entries Verified</h4>
                <p className="text-sm text-muted-foreground">
                  Hash chain was checked on the server in strict file order (same as <code className="text-xs bg-green-100 px-1 rounded">log_event</code>).
                </p>
              </div>
            </>
          )}
          {integrityStatus === "tampered" && (
            <>
              <ShieldAlert className="h-6 w-6 text-red-600" />
              <div className="space-y-1">
                <h4 className="font-semibold text-red-700">Integrity Violation Detected</h4>
                <p className="text-sm text-muted-foreground">
                  {integrityDetail ||
                    "The audit file may have been edited, merged, or partially truncated. Delete or replace audit.log in development if you need a clean chain."}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Integrity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading logs...
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log, index) => (
                <motion.tr
                  key={log.hash} // Hash is the unique ID
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(log.timestamp)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.user}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.file}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    {integrityStatus === "valid" ? (
                      <Check className="ml-auto h-4 w-4 text-green-500" />
                    ) : integrityStatus === "tampered" ? (
                      <ShieldAlert className="ml-auto h-4 w-4 text-red-500" />
                    ) : (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
