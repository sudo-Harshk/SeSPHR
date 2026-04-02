/** Guess MIME when Blob.type is empty (common after AES decrypt). */
export function mimeFromFilename(filename: string): string {
  const n = filename.toLowerCase()
  if (n.endsWith(".pdf")) return "application/pdf"
  if (n.endsWith(".txt")) return "text/plain"
  if (n.endsWith(".csv")) return "text/csv"
  if (n.endsWith(".json")) return "application/json"
  if (n.endsWith(".md")) return "text/markdown"
  if (n.endsWith(".log")) return "text/plain"
  if (n.endsWith(".html") || n.endsWith(".htm")) return "text/html"
  if (n.endsWith(".png")) return "image/png"
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg"
  if (n.endsWith(".gif")) return "image/gif"
  if (n.endsWith(".webp")) return "image/webp"
  return ""
}
