import { Info, Shield, Key, Fingerprint } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface FileItem {
    filename: string
    owner: string | null
    policy: string | null
    iv?: string
    key_blob?: string
    algorithm?: string
}

interface FileDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    file: FileItem | null
}

export default function FileDetailsDialog({
    open,
    onOpenChange,
    file,
}: FileDetailsDialogProps) {
    if (!file) return null

    const truncate = (str: string | undefined, length: number) => {
        if (!str) return "N/A"
        if (str.length <= length) return str
        return str.slice(0, length) + "..."
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Cryptographic Metadata</DialogTitle>
                            <DialogDescription className="text-slate-500">
                                Technical details for {file.filename}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <Info className="w-4 h-4 text-slate-400" />
                                <span>Algorithm</span>
                            </div>
                            <p className="text-sm font-mono text-slate-900 bg-white p-2 rounded border border-slate-100">
                                {file.algorithm || "AES-GCM-256 + RSA-OAEP"}
                            </p>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <Fingerprint className="w-4 h-4 text-slate-400" />
                                <span>Initialization Vector (IV)</span>
                            </div>
                            <p className="text-sm font-mono text-slate-900 bg-white p-2 rounded border border-slate-100 break-all">
                                {truncate(file.iv, 32)}
                            </p>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <Key className="w-4 h-4 text-slate-400" />
                                <span>Encrypted Key Blob</span>
                            </div>
                            <p className="text-sm font-mono text-slate-900 bg-white p-2 rounded border border-slate-100 break-all">
                                {truncate(file.key_blob, 64)}
                            </p>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 italic">
                        Note: This metadata is used by the client-side crypto engine to decrypt files securely.
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
