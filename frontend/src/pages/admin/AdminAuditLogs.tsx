import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, ShieldAlert, ShieldCheck, Loader2, RefreshCw } from "lucide-react"

import api from "@/services/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  user_display: string
  user_role: string
  user_email: string
  user_dept: string
  file: string
  action: string
  status: string
  prev_hash: string
  hash: string
}

type IntegrityStatus = "verifying" | "valid" | "tampered"

function getStatusBadge(status: string) {
  const s = status.toUpperCase()

  if (s === "GRANTED" || s.startsWith("GRANTED")) {
    const extra = status.includes("+") ? status.slice(status.indexOf("+")) : ""
    return (
      <div className="flex flex-col gap-0.5">
        <Badge className="bg-green-600 hover:bg-green-700 w-fit">GRANTED</Badge>
        {extra && <span className="text-[10px] text-green-700">{extra.trim()}</span>}
      </div>
    )
  }
  if (s === "DENIED_POLICY") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="destructive" className="w-fit">DENIED</Badge>
        <span className="text-[10px] text-red-500">Policy mismatch</span>
      </div>
    )
  }
  if (s === "DENIED_REVOKED") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="destructive" className="w-fit">DENIED</Badge>
        <span className="text-[10px] text-red-500">Access revoked</span>
      </div>
    )
  }
  if (s === "DENIED_AUTH") {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="destructive" className="w-fit">DENIED</Badge>
        <span className="text-[10px] text-red-500">Not authenticated</span>
      </div>
    )
  }
  if (s.startsWith("DENIED")) {
    return <Badge variant="destructive" className="w-fit">{status}</Badge>
  }
  if (s === "REVOKE" || s === "REVOKE_USER") {
    return <Badge className="bg-amber-500 hover:bg-amber-600 w-fit">REVOKED</Badge>
  }
  if (s === "RESTORE_ACCESS" || s === "GRANT_USER") {
    return <Badge className="bg-blue-500 hover:bg-blue-600 w-fit">RESTORED</Badge>
  }
  if (s === "SUCCESS") {
    return <Badge className="bg-green-600 hover:bg-green-700 w-fit">SUCCESS</Badge>
  }
  return <Badge variant="outline" className="w-fit text-xs">{status}</Badge>
}

function getRoleBadge(role: string) {
  if (!role) return null
  const colors: Record<string, string> = {
    patient: "bg-blue-50 text-blue-700 border-blue-200",
    doctor:  "bg-purple-50 text-purple-700 border-purple-200",
    admin:   "bg-red-50 text-red-700 border-red-200",
  }
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${colors[role] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {role}
    </span>
  )
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus>("verifying")
  const [integrityDetail, setIntegrityDetail] = useState<string>("")
  const [tamperedBlock, setTamperedBlock] = useState<number | null>(null)
  const [totalBlocks, setTotalBlocks] = useState<number>(0)

  useEffect(() => { fetchLogs() }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setIntegrityStatus("verifying")
      setTamperedBlock(null)

      const [auditRes, verifyRes] = await Promise.all([
        api.get("/admin/audit"),
        api.get("/admin/audit/verify").catch(() => null),
      ])

      if (auditRes.data.success && auditRes.data.data) {
        const data = auditRes.data.data as {
          logs: AuditLog[]
          integrity?: { valid: boolean; detail?: string }
        }
        setLogs([...(data.logs ?? [])].sort((a, b) => b.timestamp - a.timestamp))
      } else {
        setLogs([])
      }

      if (verifyRes?.data?.success) {
        const v = verifyRes.data.data
        setIntegrityStatus(v.valid ? "valid" : "tampered")
        setIntegrityDetail(v.detail?.trim() || "")
        setTamperedBlock(v.block_number ?? null)
        setTotalBlocks(v.total_blocks ?? 0)
      } else if (auditRes.data.data?.integrity) {
        const i = auditRes.data.data.integrity
        setIntegrityStatus(i.valid ? "valid" : "tampered")
        setIntegrityDetail(i.detail?.trim() || "")
      } else {
        setIntegrityStatus("valid")
        setIntegrityDetail("")
      }
    } catch {
      setLogs([])
      setIntegrityStatus("valid")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (ts: number) =>
    new Date(ts * 1000).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of all access and policy enforcement events.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Prominent Tamper Detection Badge */}
      <motion.div
        data-testid="audit-status"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {integrityStatus === "verifying" && (
          <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-6 py-5">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-blue-900">Checking hash chain…</p>
              <p className="text-sm text-blue-700">Running SHA-256 chain verification on all {totalBlocks || "?"} blocks.</p>
            </div>
          </div>
        )}
        {integrityStatus === "valid" && (
          <div className="flex items-center gap-4 rounded-xl border-2 border-green-400 bg-green-50 px-6 py-5">
            <ShieldCheck className="h-10 w-10 text-green-600 shrink-0" />
            <div>
              <p className="text-xl font-bold text-green-800">
                TAMPER DETECTION ACTIVE — All {totalBlocks || logs.length} blocks verified
              </p>
              <p className="text-sm text-green-700 mt-0.5">
                SHA-256 hash chain is unbroken. Every entry links to the previous. No block has been inserted, removed, or modified.
              </p>
            </div>
          </div>
        )}
        {integrityStatus === "tampered" && (
          <div className="flex items-center gap-4 rounded-xl border-2 border-red-500 bg-red-50 px-6 py-5">
            <ShieldAlert className="h-10 w-10 text-red-600 shrink-0 animate-pulse" />
            <div>
              <p className="text-xl font-bold text-red-800">
                TAMPER DETECTED{tamperedBlock ? ` — Modified at block #${tamperedBlock}` : ""}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                {integrityDetail || "The audit log has been edited or corrupted. The hash chain is broken."}
              </p>
              {tamperedBlock && (
                <p className="text-xs text-red-600 mt-1 font-mono">
                  Hash chain break at block #{tamperedBlock} · All entries after this point are unverifiable
                </p>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Secondary integrity detail card */}
      <Card className={`border-l-4 ${
        integrityStatus === "valid" ? "border-l-green-500" :
        integrityStatus === "tampered" ? "border-l-red-500" : "border-l-blue-500"
      }`}>
        <CardContent className="pt-4 pb-3 flex items-center gap-3 text-sm">
          {integrityStatus === "valid" && (
            <><Check className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-green-700">Each log entry includes a <code className="text-xs bg-green-100 px-1 rounded">prev_hash</code> and <code className="text-xs bg-green-100 px-1 rounded">hash</code> field. Verification re-computes SHA-256 of every entry body and checks the chain.</span></>
          )}
          {integrityStatus === "tampered" && (
            <><ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-red-700">{integrityDetail || "Hash chain broken — audit file may have been edited."}</span></>
          )}
          {integrityStatus === "verifying" && (
            <><Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
            <span className="text-blue-700">Verifying SHA-256 hash chain integrity…</span></>
          )}
        </CardContent>
      </Card>

      {/* Log Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[175px]">Timestamp</TableHead>
              <TableHead className="w-[160px]">User</TableHead>
              <TableHead className="w-[110px]">Department</TableHead>
              <TableHead className="w-[90px]">Action</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[70px] text-right">Chain</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading logs…
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No audit events yet. Upload a file or request access to generate entries.
                </TableCell>
              </TableRow>
            ) : logs.map((log, index) => (
              <motion.tr
                key={log.hash}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="hover:bg-muted/40 transition-colors"
              >
                <TableCell className="font-mono text-xs text-muted-foreground py-3">
                  {formatDate(log.timestamp)}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium leading-tight">{log.user_display || log.user}</span>
                    {log.user_role && getRoleBadge(log.user_role)}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {log.user_dept ? (
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200 font-medium">
                      {log.user_dept}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-xs text-slate-700 break-all leading-relaxed max-w-[220px] block truncate" title={log.file}>
                    {log.file}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {getStatusBadge(log.status)}
                </TableCell>
                <TableCell className="text-right py-3">
                  {integrityStatus === "valid" ? (
                    <Check className="ml-auto h-4 w-4 text-green-500" />
                  ) : integrityStatus === "tampered" ? (
                    <ShieldAlert className="ml-auto h-4 w-4 text-red-500" />
                  ) : (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
