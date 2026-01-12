import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer"
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF Worker (Performance Critical)
// Use a CDN that matches the installed version to avoid build/bundling issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

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
    const [textContent, setTextContent] = useState<string | null>(null)
    const [loadingText, setLoadingText] = useState(false)

    // PDF State
    const [numPages, setNumPages] = useState<number>(0)
    const [pageNumber, setPageNumber] = useState<number>(1)
    const [scale, setScale] = useState<number>(1.0)
    const [pdfLoading, setPdfLoading] = useState(false)

    // Determine if we should handle this manually (Text) or pass to DocViewer
    const isText = mimeType.startsWith("text/") ||
        filename.toLowerCase().endsWith(".txt") ||
        filename.toLowerCase().endsWith(".log") ||
        filename.toLowerCase().endsWith(".json") ||
        filename.toLowerCase().endsWith(".md")

    const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")
    const isImage = mimeType.startsWith("image/") ||
        filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)

    useEffect(() => {
        if (isOpen && fileUrl && isText) {
            setLoadingText(true)
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => {
                    setTextContent(text)
                    setLoadingText(false)
                })
                .catch(err => {
                    console.error("Failed to load text content", err)
                    setTextContent("Failed to load text content.")
                    setLoadingText(false)
                })
        } else {
            setTextContent(null)
            setLoadingText(false)
        }

        // Reset PDF state on open
        if (isOpen) {
            setPageNumber(1)
            setScale(1.0)
            setPdfLoading(true)
        }
    }, [isOpen, fileUrl, isText])

    useEffect(() => {
        // End the timer when the modal successfully opens for PDF
        if (isOpen && fileUrl && !pdfLoading && isPdf) {
            console.timeEnd("3. PDF Render")
        }
    }, [isOpen, fileUrl, pdfLoading, isPdf])

    if (!isOpen || !fileUrl) return null

    const docs = [{ uri: fileUrl, fileName: filename, fileType: mimeType }]

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
        setPdfLoading(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
                <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
                    <DialogTitle className="text-lg font-semibold truncate pr-8 flex items-center gap-2">
                        {filename}
                        {isPdf && !pdfLoading && (
                            <div className="flex items-center gap-1 text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                Page {pageNumber} of {numPages}
                            </div>
                        )}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        {isPdf && (
                            <div className="flex items-center gap-1 mr-4 bg-slate-100 rounded-md p-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.5, s - 0.1))} disabled={scale <= 0.5}>
                                    <ZoomOut className="w-4 h-4" />
                                </Button>
                                <span className="text-xs w-8 text-center">{Math.round(scale * 100)}%</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setScale(s => Math.min(2.5, s + 0.1))} disabled={scale >= 2.5}>
                                    <ZoomIn className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        {isPdf && (
                            <div className="flex items-center gap-1 mr-4">
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                                    disabled={pageNumber <= 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                                    disabled={pageNumber >= numPages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

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

                <div className="flex-1 overflow-hidden bg-slate-100 relative p-4 flex flex-col items-center justify-center">
                    {isText ? (
                        <div className="flex-1 bg-white shadow-sm border rounded-md p-6 overflow-auto w-full">
                            {loadingText ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <p>Loading text...</p>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800 break-words">
                                    {textContent}
                                </pre>
                            )}
                        </div>
                    ) : isImage ? (
                        <div className="flex-1 w-full h-full flex items-center justify-center overflow-auto bg-slate-200/50 p-4 border rounded-md shadow-inner">
                            <img
                                src={fileUrl}
                                alt={filename}
                                className="max-w-full max-h-full object-contain rounded shadow-sm bg-white"
                            />
                        </div>
                    ) : isPdf ? (
                        <div className="flex-1 w-full flex flex-col items-center overflow-auto bg-slate-200/50 p-4 border rounded-md shadow-inner">
                            <Document
                                file={fileUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex flex-col items-center gap-2 mt-20">
                                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                                        <p className="text-slate-500 text-sm">Rendering PDF...</p>
                                    </div>
                                }
                                error={
                                    <div className="text-red-500 text-sm bg-red-50 p-4 rounded-md border border-red-200 mt-20">
                                        Failed to load PDF.
                                    </div>
                                }
                                className="flex flex-col items-center"
                            >
                                <div className="shadow-lg border rounded-sm overflow-hidden bg-white">
                                    <Page
                                        pageNumber={pageNumber}
                                        scale={scale}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        width={undefined}
                                        height={undefined}
                                        className="max-w-full"
                                    />
                                </div>
                            </Document>
                        </div>
                    ) : (
                        <DocViewer
                            documents={docs}
                            pluginRenderers={DocViewerRenderers}
                            config={{
                                header: {
                                    disableHeader: true,
                                    disableFileName: true,
                                    retainURLParams: false
                                },
                            }}
                            style={{ height: '100%', width: '100%' }}
                            theme={{
                                primary: "#5296d8",
                                secondary: "#ffffff",
                                tertiary: "#5296d899",
                                textPrimary: "#ffffff",
                                textSecondary: "#5296d8",
                                textTertiary: "#00000099",
                                disableThemeScrollbar: false,
                            }}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
