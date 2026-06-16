# AI Architect Assistant — Tuần 2–3: Chat AI & Sinh Concept

---

## Thứ tự thực hiện

```
T2.1 API chat + rate limiter
  ↓
T2.2 System prompt kiến trúc  ⭐
  ↓
T2.3 UI ChatWindow
  ↓
T2.4 Lưu lịch sử hội thoại
  ↓
T3.1 Form nhập brief
  ↓
T3.2 API sinh concept
  ↓
T3.3 UI Concept cards
```

**Milestone:** Chat AI hoạt động → Lịch sử lưu được → Nhập brief → Nhận 3 concept ✓

---

## T2.1 — API route chat với streaming + rate limiter (1 ngày)

### Khởi tạo Gemini client (`lib/gemini.ts`)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const geminiFlash = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
})

export { genAI }
```

### Rate limiter (`lib/rate-limit.ts`)

```typescript
import { createClient } from '@/lib/supabase/server'

const DAILY_LIMIT = 20 // lượt/ngày/user — giữ trong free tier

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
}> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('daily_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  const count = data?.count ?? 0
  if (count >= DAILY_LIMIT) return { allowed: false, remaining: 0 }

  await supabase.from('daily_usage').upsert(
    { user_id: userId, date: today, count: count + 1 },
    { onConflict: 'user_id,date' }
  )

  return { allowed: true, remaining: DAILY_LIMIT - count - 1 }
}
```

> **Tại sao 20 lượt/ngày an toàn:** Free tier 1,500 req/ngày ÷ 20 = **75 user hoạt động/ngày** hoàn toàn $0.

### API route với streaming (`app/api/chat/route.ts`)

```typescript
import { geminiFlash } from '@/lib/gemini'
import { checkRateLimit } from '@/lib/rate-limit'
import { systemPrompt } from '@/lib/prompts/system'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, remaining } = await checkRateLimit(user.id)
  if (!allowed) {
    return Response.json(
      { error: 'Đã hết lượt hôm nay. Quay lại vào ngày mai!' },
      { status: 429 }
    )
  }

  const { messages } = await req.json()

  const chat = geminiFlash.startChat({
    systemInstruction: systemPrompt,
    history: messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user', // Gemini dùng 'model' thay vì 'assistant'
      parts: [{ text: m.content }],
    })),
  })

  const lastMessage = messages[messages.length - 1].content
  const result = await chat.sendMessageStream(lastMessage)

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) controller.enqueue(new TextEncoder().encode(text))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Remaining-Requests': String(remaining),
    },
  })
}
```

---

## T2.2 — System prompt chuyên ngành kiến trúc (1 ngày) ⭐

> Đây là việc quan trọng nhất giai đoạn này. System prompt quyết định 70% chất lượng sản phẩm.

**File:** `lib/prompts/system.ts`

**System prompt cần bao gồm:**
- Vai trò: trợ lý kiến trúc sư Việt Nam chuyên nghiệp
- Thuật ngữ chuyên ngành: mặt bằng, mặt đứng, mặt cắt, thông thủy, khoảng lùi, PCCC...
- Các phong cách kiến trúc phổ biến tại VN: nhiệt đới hiện đại, Indochine, minimalism, neoclassic...
- Hiểu quy chuẩn xây dựng Việt Nam (QCVN 03, QCVN 06...)
- Cách phân tích brief và đặt câu hỏi làm rõ
- Format trả lời rõ ràng, có cấu trúc

**Cần test với các loại brief:** nhà phố, biệt thự, căn hộ, văn phòng, nhà hàng, trường học.

---

## T2.3 — UI ChatWindow component (1.5 ngày)

**Files cần tạo:**
- `components/chat/ChatWindow.tsx` — container chính
- `components/chat/MessageBubble.tsx` — hiển thị từng tin nhắn
- `components/chat/ChatInput.tsx` — ô nhập + nút gửi
- `hooks/useChat.ts` — logic gọi API, quản lý state

**Tính năng cần có:**
- Streaming text hiển thị từng token
- Auto-scroll xuống tin nhắn mới nhất
- Markdown rendering (bold, code block, danh sách)
- Trạng thái loading (typing indicator)
- Hiển thị số lượt còn lại trong ngày
- Nút copy nội dung assistant
- Responsive mobile

---

## T2.4 — Lưu & tải lịch sử hội thoại (1 ngày)

**Files cần tạo:**
- `components/sidebar/ConversationList.tsx`
- `lib/db/conversations.ts`
- `app/(app)/chat/[id]/page.tsx`

**Logic:**
1. Mỗi tin nhắn gửi đi → lưu vào bảng `messages`
2. Sau response hoàn chỉnh → lưu assistant message
3. Sidebar hiển thị danh sách conversation, sắp xếp theo `updated_at`
4. Chuyển conversation → fetch lại messages theo `conversation_id`
5. Auto-generate title từ tin nhắn đầu tiên (gọi Gemini rút gọn)

---

## T3.1 — Form nhập Brief dự án (0.5 ngày)

**File:** `components/concept/BriefForm.tsx`

| Trường | Loại | Ghi chú |
|--------|------|---------|
| Loại công trình | Select | Nhà phố, biệt thự, căn hộ, văn phòng... |
| Diện tích đất | Number | m² |
| Số tầng dự kiến | Number | |
| Ngân sách | Select | Dưới 1 tỷ, 1–3 tỷ, 3–5 tỷ, trên 5 tỷ |
| Phong cách mong muốn | Multi-select | Hiện đại, nhiệt đới, tối giản, cổ điển... |
| Mô tả tự do | Textarea | Brief chi tiết từ khách hàng |

---

## T3.2 — API sinh 3 hướng concept (1 ngày)

**File:** `app/api/concept/route.ts`

```typescript
import { genAI } from '@/lib/gemini'
import { conceptPrompt } from '@/lib/prompts/concept'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { brief } = await req.json()

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json', // Native JSON mode — không lo text thừa
    },
  })

  const result = await model.generateContent(conceptPrompt(brief))
  const text = result.response.text()

  try {
    const concepts = JSON.parse(text)
    return Response.json({ concepts })
  } catch {
    return Response.json({ error: 'Parse failed', raw: text }, { status: 500 })
  }
}
```

**Cấu trúc JSON mỗi concept (`types/concept.ts`):**

```typescript
export interface Concept {
  id: string
  name: string           // Tên concept (VD: "Nhiệt đới Hiện đại")
  tagline: string        // Câu mô tả ngắn
  description: string    // Mô tả chi tiết 2-3 đoạn
  style: string[]        // Từ khóa phong cách
  materials: string[]    // Vật liệu gợi ý
  colorPalette: string[] // Bảng màu chủ đạo
  references: string[]   // Công trình tham khảo
  reasoning: string      // Lý do phù hợp với brief
}
```

---

## T3.3 — UI hiển thị 3 Concept cards (1 ngày)

**Files cần tạo:**
- `components/concept/ConceptCard.tsx`
- `components/concept/ConceptGrid.tsx`

**Mỗi card hiển thị:**
- Tên concept + tagline
- Mô tả ngắn
- Tags phong cách
- Vật liệu gợi ý
- Bảng màu (ô màu nhỏ)
- Nút "Chọn hướng này" → mở chat tiếp về concept đó
- Nút "Tìm hiểu thêm" → expand hoặc chat

---

*Quay lại: `01-tong-quan.md` · `02-techstack-va-ai.md` · `03-tuan1-nen-tang.md`*
