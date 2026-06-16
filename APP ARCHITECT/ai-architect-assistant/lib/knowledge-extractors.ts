import type { FileType } from './knowledge-types'

export async function extractText(buffer: Buffer, fileType: FileType): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return extractPdf(buffer)
    case 'docx':
      return extractDocx(buffer)
    case 'txt':
      return buffer.toString('utf-8')
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse')
  const data = await pdfParse(buffer)
  return data.text as string
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export function detectFileType(filename: string): FileType | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt' || ext === 'md') return 'txt'
  return null
}
