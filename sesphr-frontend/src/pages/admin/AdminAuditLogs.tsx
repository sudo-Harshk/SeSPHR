import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, ShieldAlert, ShieldCheck, Loader2, FileText, Info } from "lucide-react"

import api from "@/services/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await api.get("/audit/logs")
      if (response.data.success && response.data.data.logs) {
        const fetchedLogs = response.data.data.logs
        // Sort by timestamp descending for display (latest first)
        const sortedLogs = [...fetchedLogs].sort((a: AuditLog, b: AuditLog) => b.timestamp - a.timestamp)
        setLogs(sortedLogs)

        // Use the original fetched order (or sort chronologically) for verification
        // Assuming backend returns chronological or we must sort to reconstruct chain
        const chronologicalLogs = [...fetchedLogs].sort((a: AuditLog, b: AuditLog) => a.timestamp - b.timestamp)
        verifyIntegrity(chronologicalLogs)
      } else {
        setLogs([])
        setIntegrityStatus("valid") // Empty is valid
      }
    } catch (error) {
      console.error("Failed to fetch audit logs", error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const verifyIntegrity = async (chronologicalLogs: AuditLog[]) => {
    setIntegrityStatus("verifying")

    // Artificial small delay to show the verifying state (UX)
    await new Promise(resolve => setTimeout(resolve, 800))

    let isValid = true

    // Check if logs are empty
    if (chronologicalLogs.length === 0) {
      setIntegrityStatus("valid")
      return
    }

    try {
      for (let i = 0; i < chronologicalLogs.length; i++) {
        const log = chronologicalLogs[i]

        // 1. Verify prev_hash link (except for the very first one logic)
        // We only strictly check if we have the previous item in this list.
        if (i > 0) {
          if (log.prev_hash !== chronologicalLogs[i - 1].hash) {
            console.error(`Hash chain broken at index ${i}: prev_hash mismatch`, {
              currentPrev: log.prev_hash,
              prevActual: chronologicalLogs[i - 1].hash
            })
            isValid = false
            break
          }
        }

        // 2. Recompute Hash
        const computedHash = await computeHash(log)

        if (computedHash !== log.hash) {
          console.error(`Hash mismatch at index ${i}:`, { computed: computedHash, stored: log.hash, log })
          isValid = false
          break
        }
      }
    } catch (e) {
      console.error("Verification error", e)
      isValid = false
    }

    setIntegrityStatus(isValid ? "valid" : "tampered")
  }

  const computeHash = async (l: AuditLog) => {
    // CANONICAL SERIALIZATION - STRICT ORDER & FORMATTING
    // Python's json.dumps(sort_keys=True) produces keys in alphabetical order.
    // Separators are (', ', ': ') by default.

    // We use JSON.stringify for values to handle escaping correctly (e.g. quotes in filenames),
    // but manually construct the outer JSON object to ensure exact spacing and key order.

    // Keys: action, file, prev_hash, status, timestamp, user

    const canonical = `{` +
      `"action": ${JSON.stringify(l.action)}, ` +
      `"file": ${JSON.stringify(l.file)}, ` +
      `"prev_hash": ${JSON.stringify(l.prev_hash)}, ` +
      `"status": ${JSON.stringify(l.status)}, ` +
      `"timestamp": ${l.timestamp}, ` +
      `"user": ${JSON.stringify(l.user)}` +
      `}`

    // Hash using SHA-256
    const msgBuffer = new TextEncoder().encode(canonical)
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")

    return hashHex
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
                <h4 className="font-semibold">Verifying Audit Integrity...</h4>
                <p className="text-sm text-muted-foreground">Recomputing cryptographic hash chains for all entries.</p>
              </div>
            </>
          )}
          {integrityStatus === "valid" && (
            <>
              <ShieldCheck className="h-6 w-6 text-green-600" />
              <div className="space-y-1">
                <h4 className="font-semibold text-green-700">All Audit Entries Verified</h4>
                <p className="text-sm text-muted-foreground">Cryptographic hash chain is intact. No tampering detected.</p>
              </div>
            </>
          )}
          {integrityStatus === "tampered" && (
            <>
              <ShieldAlert className="h-6 w-6 text-red-600" />
              <div className="space-y-1">
                <h4 className="font-semibold text-red-700">Integrity Violation Detected</h4>
                <p className="text-sm text-muted-foreground">Hash mismatches found. The audit log may have been altered manually.</p>
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
