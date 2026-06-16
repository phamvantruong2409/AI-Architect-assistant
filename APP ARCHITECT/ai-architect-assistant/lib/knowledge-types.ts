export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error'
export type DocumentCategory = 'TCVN' | 'QCVN' | 'PCCC' | 'general'
export type FileType = 'pdf' | 'docx' | 'txt'

export interface KnowledgeDocument {
  id: string
  name: string
  file_type: FileType
  category: DocumentCategory
  content: string
  status: DocumentStatus
  chunk_count: number
  error_message?: string | null
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  created_at: string
}

export interface MatchedChunk {
  id: string
  document_id: string
  document_name: string
  category: string
  content: string
  similarity: number
}

export interface KnowledgeChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: MatchedChunk[]
}
