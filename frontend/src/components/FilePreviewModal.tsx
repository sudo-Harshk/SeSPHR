import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

interface FilePreviewModalProps {
    isOpen: boolean
    onClose: () => void
    fileUrl: string | null
    filename: string
    mimeType: string
}

export default function FilePreviewModal({
    isOpen,
    onClose,
    fileUrl,
    filename,
    mimeType,
}: FilePreviewModalProps) {
    if (!isOpen || !fileUrl) return null

    const isImage = mimeType.startsWith("image/")
    const isPdf = mimeType === "application/pdf"

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-lg font-semibold truncate pr-8">
                        {filename}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                const link = document.createElement("a")
                                link.href = fileUrl
                                link.download = filename
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                            }}
                            title="Download"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onClose}
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4">
                    {isImage ? (
                        <img
                            src={fileUrl}
                            alt={filename}
                            className="max-w-full max-h-full object-contain shadow-md"
                        />
                    ) : isPdf ? (
                        <iframe
                            src={fileUrl}
                            className="w-full h-full bg-white shadow-md border-0"
                            title={filename}
                        />
                    ) : (
                        <div className="text-center space-y-3">
                            <p className="text-slate-500">
                                Preview not available for this file type.
                            </p>
                            <Button onClick={() => {
                                const link = document.createElement("a")
                                link.href = fileUrl
                                link.download = filename
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                            }}>
                                <Download className="w-4 h-4 mr-2" />
                                Download File
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
