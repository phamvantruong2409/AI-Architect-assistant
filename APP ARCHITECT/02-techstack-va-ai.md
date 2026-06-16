# AI Architect Assistant — Tech Stack & Chiến lược AI

---

## Tech stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Ngôn ngữ | TypeScript |
| AI | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| Auth + DB | Supabase |
| Styling | Tailwind CSS |
| Deploy | Vercel |

---

## Chiến lược AI — $0 hoàn toàn giai đoạn đầu

**Dùng 1 API key của bạn, chạy hoàn toàn trong free tier Google AI Studio.**

| Tiêu chí | Chi tiết |
|----------|----------|
| Chi phí | **$0** — miễn phí hoàn toàn |
| Free tier | 15 request/phút · 1,500 request/ngày |
| Vision | Có — dùng cho đánh giá ảnh render (Giai đoạn 2) |
| Tạo key | Miễn phí tại https://aistudio.google.com/apikey |

**Cách hoạt động:**
- Bạn tạo 1 API key miễn phí tại Google AI Studio
- Key đặt trong biến môi trường server-side (`GEMINI_API_KEY`) — user không bao giờ thấy key
- App giới hạn mỗi user tối đa **20 lượt/ngày** → tổng ~75 user/ngày vẫn nằm trong free tier
- Khi có traction và doanh thu → nâng lên trả phí API + thu subscription để bù chi phí

> **Lộ trình:** Beta ($0, free tier) → Có user → Thu phí subscription → Trả phí API bằng doanh thu.

---

## Cấu trúc thư mục

```
ai-architect-assistant/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── chat/
│   │   │   └── [id]/page.tsx
│   │   ├── concept/page.tsx
│   │   └── layout.tsx
│   └── api/
│       ├── chat/route.ts
│       └── concept/route.ts
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ChatInput.tsx
│   ├── concept/
│   │   ├── BriefForm.tsx
│   │   ├── ConceptCard.tsx
│   │   └── ConceptGrid.tsx
│   └── sidebar/
│       └── ConversationList.tsx
├── lib/
│   ├── gemini.ts
│   ├── rate-limit.ts
│   ├── prompts/
│   │   ├── system.ts
│   │   └── concept.ts
│   ├── db/
│   │   └── conversations.ts
│   └── supabase/
│       ├── client.ts
│       └── server.ts
├── hooks/
│   └── useChat.ts
├── types/
│   ├── database.ts
│   ├── brief.ts
│   └── concept.ts
└── supabase/
    └── migrations/
        └── 001_init.sql
```

---

## Ghi chú kỹ thuật

- **$0 hoàn toàn giai đoạn beta** — 1 API key Gemini free tier, giới hạn 20 lượt/ngày/user → ~75 user hoạt động/ngày không tốn xu nào
- **Streaming bắt buộc** — không dùng API call thường, user chờ >5 giây sẽ thoát
- **System prompt là linh hồn** — dành thời gian test nhiều loại brief trước khi ship
- **Gemini JSON mode** — dùng `responseMimeType: 'application/json'` cho các tính năng cần structured output, không cần parse thủ công
- **Role mapping** — Gemini dùng `model` thay vì `assistant`, nhớ map khi truyền chat history
- **RLS Supabase** — setup ngay từ đầu, không để sau
- **Rate limiter bảo vệ free tier** — lưu `daily_usage` trong Supabase, reset mỗi ngày, trả lỗi 429 kèm thông báo thân thiện khi hết lượt
- **Tín hiệu scale** — khi thấy >50 user/ngày hoạt động đều → đó là lúc chuyển sang trả phí API và thu subscription
