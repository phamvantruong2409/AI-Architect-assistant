import { getGeminiEmbeddingModel } from './gemini'
import { deepseekGenerateChat } from './deepseek'
import { DEEPSEEK_MODELS } from './ai-models'
import type { KnowledgeChatMessage, MatchedChunk } from './knowledge-types'

// Embedding (tìm kiếm vector) BẮT BUỘC dùng Gemini text-embedding-004 — DeepSeek
// không có endpoint embedding. Chỉ phần SINH CÂU TRẢ LỜI mới dùng DeepSeek V4 Pro.
export async function embedText(text: string): Promise<number[]> {
  const model = getGeminiEmbeddingModel()
  const result = await model.embedContent(text)
  return result.embedding.values
}

export async function generateAnswer(
  question: string,
  chunks: MatchedChunk[],
  history: KnowledgeChatMessage[]
): Promise<string> {
  const context = chunks
    .map((c, i) => `[${i + 1}] Nguồn: ${c.document_name}\n${c.content}`)
    .join('\n\n---\n\n')

  const systemPrompt = `Bạn là trợ lý AI chuyên về kiến trúc và pháp lý xây dựng Việt Nam.
Dựa vào tài liệu tham khảo bên dưới, trả lời câu hỏi một cách chính xác, ngắn gọn và có trích dẫn nguồn cụ thể.
Nếu tài liệu không đủ thông tin, hãy nói rõ và đề xuất tìm thêm ở đâu.
Trả lời bằng tiếng Việt.

TÀI LIỆU THAM KHẢO:
${context}`

  const messages = [
    ...history.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
    { role: 'user' as const, content: question },
  ]

  return deepseekGenerateChat({
    model: DEEPSEEK_MODELS[0].id, // deepseek-v4-pro
    system: systemPrompt,
    messages,
  })
}
