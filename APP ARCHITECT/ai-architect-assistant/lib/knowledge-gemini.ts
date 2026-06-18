import { getGeminiModel, getGeminiEmbeddingModel } from './gemini'
import type { KnowledgeChatMessage, MatchedChunk } from './knowledge-types'

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
  const model = getGeminiModel()

  const context = chunks
    .map((c, i) => `[${i + 1}] Nguồn: ${c.document_name}\n${c.content}`)
    .join('\n\n---\n\n')

  const systemPrompt = `Bạn là trợ lý AI chuyên về kiến trúc và pháp lý xây dựng Việt Nam.
Dựa vào tài liệu tham khảo bên dưới, trả lời câu hỏi một cách chính xác, ngắn gọn và có trích dẫn nguồn cụ thể.
Nếu tài liệu không đủ thông tin, hãy nói rõ và đề xuất tìm thêm ở đâu.
Trả lời bằng tiếng Việt.

TÀI LIỆU THAM KHẢO:
${context}`

  const chatHistory = [
    { role: 'user' as const, parts: [{ text: systemPrompt }] },
    {
      role: 'model' as const,
      parts: [{ text: 'Đã hiểu. Tôi sẽ trả lời dựa trên tài liệu được cung cấp và trích dẫn nguồn rõ ràng.' }],
    },
    ...history.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
  ]

  const chat = model.startChat({ history: chatHistory })
  const result = await chat.sendMessage(question)
  return result.response.text()
}
