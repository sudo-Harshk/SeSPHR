import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, Zap, Clock, Shield, TrendingDown, Play, AlertTriangle, Network } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import api from "@/services/api"

interface BenchmarkRow {
  file_size: string
  encryption_time: number
  srs_time: number
  decryption_time: number
  encryption_time_ms?: number
  srs_time_ms?: number
  decryption_time_ms?: number
  file_size_kb?: number
}

type CryptoMode = "rsa-pre" | "cpabe"

const COLORS = {
  encryption: "#3b82f6",
  srs: "#8b5cf6",
  decryption: "#10b981",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-800 mb-2">{label} MB</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-slate-600">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}:</span>
            <span className="font-mono font-medium">{(p.value * 1000).toFixed(1)} ms</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function AdminBenchmark() {
  const [data, setData] = useState<BenchmarkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cryptoMode, setCryptoMode] = useState<CryptoMode>("rsa-pre")

  useEffect(() => {
    api.get("/admin/benchmark")
      .then((res) => {
        if (res.data.success) setData(res.data.data.results)
        else setError(res.data.error || "Failed to load")
      })
      .catch(() => setError("Failed to fetch benchmark data"))
      .finally(() => setLoading(false))
  }, [])

  const runLiveBenchmark = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await api.post(`/admin/benchmark?mode=${cryptoMode}`)
      if (res.data.success) {
        setData(res.data.data.results)
      } else {
        setError(res.data.error || "Benchmark failed")
      }
    } catch {
      setError("Live benchmark failed")
    } finally {
      setRunning(false)
    }
  }

  const avgSRS = data.length ? data.reduce((s, r) => s + r.srs_time, 0) / data.length : 0
  const avgEnc = data.length ? data.reduce((s, r) => s + r.encryption_time, 0) / data.length : 0
  const avgDec = data.length ? data.reduce((s, r) => s + r.decryption_time, 0) / data.length : 0
  const maxSRSVariation = data.length
    ? Math.max(...data.map(r => r.srs_time)) - Math.min(...data.map(r => r.srs_time))
    : 0

  const chartData = data.map((r) => ({
    name: r.file_size,
    "Encryption (AES-GCM)": r.encryption_time,
    "SRS Re-encryption (RSA)": r.srs_time,
    "Decryption": r.decryption_time,
  }))

  const largestEnc = data.length ? Math.max(...data.map(r => r.encryption_time)) : 0
  const largestEncMs = (largestEnc * 1000).toFixed(0)
  const avgSRSMs = (avgSRS * 1000).toFixed(0)

  const statCards = [
    {
      icon: Zap,
      label: "Avg. Encryption",
      value: `${(avgEnc * 1000).toFixed(1)} ms`,
      sub: "AES-GCM-256, client-side",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Shield,
      label: "Avg. SRS Re-encryption",
      value: `${(avgSRS * 1000).toFixed(0)} ms`,
      sub: "RSA-OAEP key transform",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: Clock,
      label: "Avg. Decryption",
      value: `${(avgDec * 1000).toFixed(1)} ms`,
      sub: "AES-GCM, browser-side",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      icon: TrendingDown,
      label: "SRS Overhead Variance",
      value: `${(maxSRSVariation * 1000).toFixed(1)} ms`,
      sub: "Across all file sizes",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Benchmarks</h1>
            <p className="text-muted-foreground mt-1">
              Proof that proxy re-encryption is constant time regardless of file size.
            </p>
          </div>
          <Button
            data-testid="benchmark-run"
            onClick={runLiveBenchmark}
            disabled={running || loading}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running…" : "Run Live Benchmark"}
          </Button>
        </div>
      </motion.div>

      {/* Crypto Mode Toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-800 flex items-center gap-2">
                  <Network className="h-4 w-4 text-slate-500" />
                  Crypto Mode
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select the encryption scheme for the benchmark
                </p>
              </div>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
                <button
                  className={`px-5 py-2 transition-colors ${
                    cryptoMode === "rsa-pre"
                      ? "bg-purple-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setCryptoMode("rsa-pre")}
                >
                  RSA-PRE
                </button>
                <button
                  type="button"
                  data-testid="benchmark-mode-cpabe"
                  className={`px-5 py-2 border-l border-slate-200 transition-colors ${
                    cryptoMode === "cpabe"
                      ? "bg-amber-500 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setCryptoMode("cpabe")}
                >
                  CP-ABE (Simulated)
                </button>
              </div>
            </div>

            {cryptoMode === "cpabe" && (
              <motion.div
                data-testid="cpabe-simulation-warning"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-amber-900 text-base">
                      ⚠ Conceptual simulation — NOT real CP-ABE. Pairing-based cryptography not implemented.
                    </p>
                    <p className="text-sm text-amber-800 mt-1">
                      In real CP-ABE, the access policy is embedded inside the ciphertext itself using bilinear pairings.
                      Any user whose attributes satisfy the policy can decrypt — without contacting a central re-encryption server.
                      This benchmark uses RSA-OAEP as a stand-in to measure timing. The conceptual flow is logged server-side.
                    </p>
                    <div className="mt-3 rounded-md bg-amber-100 border border-amber-300 px-3 py-2 text-xs font-mono text-amber-900">
                      CP-ABE concept: <span className="font-bold">CT = Encrypt(pk, M, policy)</span><br />
                      Decrypt if: <span className="font-bold">attributes satisfy policy</span> (no SRS needed)
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {cryptoMode === "rsa-pre" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-800"
              >
                <strong>RSA-PRE flow:</strong> Patient encrypts AES key for SRS public key →
                SRS re-encrypts for doctor's public key → Doctor decrypts with their private key.
                The file itself is never touched by SRS.
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Complexity Comparison — visible without reading the graph */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-l-4 border-l-purple-500 bg-purple-50/40">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-purple-900">
                  SRS processes only 32-byte AES key, never the file.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="rounded-lg bg-white border border-blue-200 px-4 py-3" data-testid="benchmark-on">
                    <p className="text-xs text-blue-500 uppercase tracking-wide font-medium mb-1">File Encryption</p>
                    <p className="font-bold text-blue-700 text-lg">O(n)</p>
                    <p className="text-xs text-slate-600">Grows with file size</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      10 MB → ~{largestEncMs} ms
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-purple-200 px-4 py-3" data-testid="benchmark-o1">
                    <p className="text-xs text-purple-500 uppercase tracking-wide font-medium mb-1">Re-encryption</p>
                    <p className="font-bold text-purple-700 text-lg">O(1)</p>
                    <p className="text-xs text-slate-600">Constant regardless of file size</p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      Any size → ~{avgSRSMs} ms
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-6">{error}</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
              >
                <Card>
                  <CardContent className="pt-5">
                    <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{card.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle>Operation Times by File Size</CardTitle>
                <CardDescription>
                  <span className="text-blue-600 font-medium">Encryption (AES-GCM): O(n)</span>
                  {" "}&nbsp;·&nbsp;{" "}
                  <span className="text-purple-600 font-medium">Re-encryption (RSA-OAEP): O(1)</span>
                  {" "}&nbsp;·&nbsp;{" "}
                  <span className="text-green-600 font-medium">Decryption: O(n)</span>
                </CardDescription>
              </CardHeader>
              <CardContent data-testid="benchmark-bar-chart">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} label={{ value: "File size (MB)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis
                      tickFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                      tick={{ fontSize: 11 }}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Encryption (AES-GCM)" fill={COLORS.encryption} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="SRS Re-encryption (RSA)" fill={COLORS.srs} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Decryption" fill={COLORS.decryption} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* SRS Flatness Line Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader>
                <CardTitle>SRS Re-encryption: Constant-Time Proof</CardTitle>
                <CardDescription>
                  <span className="text-purple-600 font-semibold">Purple line (RSA-OAEP): flat = O(1)</span>
                  {"  "}·{"  "}
                  <span className="text-blue-500 font-semibold">Blue dashed (AES-GCM): rising = O(n)</span>
                  {"  "}·{"  "}
                  SRS only touches the 32-byte AES key, never the file.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} label={{ value: "File size (MB)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis
                      tickFormatter={(v) => `${(v * 1000).toFixed(0)}ms`}
                      tick={{ fontSize: 11 }}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine
                      y={avgSRS}
                      stroke="#8b5cf6"
                      strokeDasharray="6 3"
                      label={{ value: `O(1) avg ${avgSRSMs}ms`, position: "right", fontSize: 11, fill: "#8b5cf6" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="SRS Re-encryption (RSA)"
                      stroke={COLORS.srs}
                      strokeWidth={3}
                      dot={{ r: 5, fill: COLORS.srs }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Encryption (AES-GCM)"
                      stroke={COLORS.encryption}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone"
                      dataKey="Decryption"
                      stroke={COLORS.decryption}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      strokeDasharray="4 2"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Raw Data Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader>
                <CardTitle>Raw Measurements</CardTitle>
                <CardDescription>
                  Note how SRS column stays nearly constant while Encryption grows — this is the O(1) vs O(n) proof.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        {[
                          "File Size (MB)",
                          "Encryption (AES-GCM) — O(n)",
                          "SRS Re-encryption — O(1)",
                          "Decryption (AES-GCM) — O(n)",
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{row.file_size}</td>
                          <td className="px-4 py-3 font-mono text-blue-700">{(row.encryption_time * 1000).toFixed(1)} ms</td>
                          <td className="px-4 py-3 font-mono text-purple-700 font-semibold">{(row.srs_time * 1000).toFixed(1)} ms</td>
                          <td className="px-4 py-3 font-mono text-green-700">{(row.decryption_time * 1000).toFixed(1)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
