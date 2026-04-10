import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, Zap, Clock, Shield, TrendingDown } from "lucide-react"
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
import api from "@/services/api"

interface BenchmarkRow {
  file_size: string
  encryption_time: number
  srs_time: number
  decryption_time: number
}

const COLORS = {
  encryption: "#3b82f6",
  srs: "#8b5cf6",
  decryption: "#10b981",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-800 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-slate-600">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}:</span>
            <span className="font-mono font-medium">{p.value.toFixed(4)}s</span>
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get("/admin/benchmark")
      .then((res) => {
        if (res.data.success) setData(res.data.data.results)
        else setError(res.data.error || "Failed to load")
      })
      .catch(() => setError("Failed to fetch benchmark data"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-12">{error}</div>
    )
  }

  const avgSRS = data.reduce((s, r) => s + r.srs_time, 0) / data.length
  const avgEnc = data.reduce((s, r) => s + r.encryption_time, 0) / data.length
  const avgDec = data.reduce((s, r) => s + r.decryption_time, 0) / data.length
  const maxSRSVariation = Math.max(...data.map(r => r.srs_time)) - Math.min(...data.map(r => r.srs_time))

  const chartData = data.map((r) => ({
    name: r.file_size,
    "Encryption (AES-GCM)": r.encryption_time,
    "SRS Re-encryption (RSA)": r.srs_time,
    "Decryption": r.decryption_time,
  }))

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
        <h1 className="text-3xl font-bold tracking-tight">Performance Benchmarks</h1>
        <p className="text-muted-foreground mt-1">
          Measured encryption, SRS re-encryption, and decryption times from{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">benchmark_results.csv</code>.
        </p>
      </motion.div>

      {/* Key Insight Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-l-4 border-l-purple-500 bg-purple-50/40">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-purple-900">Key Insight: SRS overhead is constant regardless of file size</p>
                <p className="text-sm text-purple-700 mt-0.5">
                  The SRS (Setup and Re-encryption Server) re-encrypts only the <strong>32-byte AES key</strong>, not the
                  file itself. This means proxy re-encryption cost stays flat at ~{(avgSRS * 1000).toFixed(0)} ms
                  whether the file is 100 KB or 10 MB — a core design advantage of the SeSPHR methodology.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
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
              All three operations across 100 KB → 10 MB. Note the SRS bar remains nearly flat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
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
              SRS time plotted across file sizes. The flat line proves the proxy only touches the key, not the data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[0, 0.3]}
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
                  label={{ value: `avg ${(avgSRS * 1000).toFixed(0)}ms`, position: "right", fontSize: 11, fill: "#8b5cf6" }}
                />
                <Line
                  type="monotone"
                  dataKey="SRS Re-encryption (RSA)"
                  stroke={COLORS.srs}
                  strokeWidth={2.5}
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
            <CardDescription>Source: benchmark_results.csv</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {["File Size", "Encryption (AES-GCM)", "SRS Re-encryption", "Decryption"].map((h) => (
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
                      <td className="px-4 py-3 font-mono text-blue-700">{(row.encryption_time * 1000).toFixed(2)} ms</td>
                      <td className="px-4 py-3 font-mono text-purple-700">{(row.srs_time * 1000).toFixed(2)} ms</td>
                      <td className="px-4 py-3 font-mono text-green-700">{(row.decryption_time * 1000).toFixed(2)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
