import { FileText, Upload, Shield, ArrowRight, Download, CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function PatientDashboardPreview() {
    return (
        <div className="space-y-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
            <div className="space-y-1 mb-4">
                <h3 className="text-xl font-bold text-slate-900 leading-none">Patient Dashboard</h3>
                <p className="text-xs text-slate-500">Manage your Personal Health Records</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-medium text-slate-500">Total Files</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-[10px] text-slate-400">Encrypted records</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-medium text-slate-500">Access Policies</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                        <div className="text-2xl font-bold">Active</div>
                        <p className="text-[10px] text-slate-400">3 doctors authorized</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Recent Uploads</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-white border rounded-lg">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500" />
                                <span className="text-xs font-medium text-slate-700">Lab_Report_{2023 + i}.pdf</span>
                            </div>
                            <span className="text-[10px] text-slate-400">Encrypted</span>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
                <Button size="sm" className="w-full text-xs h-8">
                    <Upload className="w-3 h-3 mr-1.5" /> Upload
                </Button>
                <Button size="sm" variant="outline" className="w-full text-xs h-8">
                    <Shield className="w-3 h-3 mr-1.5" /> Policies
                </Button>
            </div>
        </div>
    )
}

export function DoctorDashboardPreview() {
    return (
        <div className="space-y-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
            <div className="space-y-1 mb-4">
                <h3 className="text-xl font-bold text-slate-900 leading-none">Doctor Dashboard</h3>
                <p className="text-xs text-slate-500">Securely access patient records</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-medium text-slate-500">Prior Authorizations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                        <div className="text-2xl font-bold">5</div>
                        <p className="text-[10px] text-slate-400">Verified access tokens</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-medium text-slate-500">Pending Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                        <div className="text-2xl font-bold">2</div>
                        <p className="text-[10px] text-slate-400">Awaiting approval</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Access Workflow</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>Verify Attributes</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>Retrieve Key</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Download className="w-3 h-3 text-blue-500" />
                        <span>Decrypt & View</span>
                    </div>
                </CardContent>
            </Card>

            <Button size="sm" className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                <Shield className="w-3 h-3 mr-1.5" /> Request Access
            </Button>
        </div>
    )
}
