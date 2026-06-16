# AI Architect Assistant — Tuần 1: Nền tảng dự án

---

## Thứ tự thực hiện

```
T1.1 Khởi tạo project
  ↓
T1.2 Auth Supabase
  ↓
T1.3 Schema database
```

**Milestone:** Đăng nhập được, database chạy, sẵn sàng để build tính năng ✓

---

## T1.1 — Khởi tạo project & cấu trúc thư mục (0.5 ngày)

Setup Next.js + TypeScript, cài dependencies, cấu hình ESLint/Prettier.

```bash
npx create-next-app@latest ai-architect-assistant \
  --typescript --tailwind --eslint --app --src-dir=false
cd ai-architect-assistant
npm install @google/generative-ai @supabase/ssr @supabase/supabase-js
```

---

## T1.2 — Auth với Supabase (1 ngày)

Đăng ký / đăng nhập bằng email + Google OAuth. Middleware bảo vệ route. Session tự động refresh.

**Files cần tạo:**
- `app/(auth)/login/page.tsx`
- `middleware.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`

**Lưu ý:** Dùng `@supabase/ssr` thay vì `@supabase/auth-helpers-nextjs` (deprecated).

**Biến môi trường (`.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GEMINI_API_KEY=your_gemini_key
```

---

## T1.3 — Schema database ban đầu (0.5 ngày)

**File:** `supabase/migrations/001_init.sql`

```sql
-- Profiles (extend auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Projects
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  brief jsonb,
  created_at timestamptz default now()
);

-- Conversations
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Rate limiting
create table public.daily_usage (
  user_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  count integer default 0,
  primary key (user_id, date)
);

-- RLS: mỗi user chỉ đọc/ghi dữ liệu của chính mình
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.daily_usage enable row level security;

create policy "Users own their data" on public.profiles
  for all using (auth.uid() = id);

create policy "Users own their projects" on public.projects
  for all using (auth.uid() = user_id);

create policy "Users own their conversations" on public.conversations
  for all using (auth.uid() = user_id);

create policy "Users own their messages" on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

create policy "Users own their usage" on public.daily_usage
  for all using (auth.uid() = user_id);
```

---

*Tiếp theo: `04-tuan2-chat-va-concept.md`*
