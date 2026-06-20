-- Trung tâm thông báo (cái chuông ở sidebar).
-- Chạy 1 lần trong Supabase → SQL Editor.
-- Sau đó đăng tin bằng Table Editor (thêm 1 dòng) là tất cả user thấy ngay.

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  cta_label   text,                          -- nhãn nút, vd 'Xem ngay'
  cta_url     text,                          -- link nút: '/massing' (nội bộ) hoặc 'https://...'
  kind        text not null default 'news',  -- 'news' | 'marketing' | 'release'
  published   boolean not null default true, -- bỏ tích để ẩn tin
  created_at  timestamptz not null default now()
);

-- Cho phép mọi người (kể cả khách) ĐỌC tin đã xuất bản; chỉ bạn (qua dashboard)
-- mới ghi được, nên không cần policy insert/update cho client.
alter table public.announcements enable row level security;

drop policy if exists "read published announcements" on public.announcements;
create policy "read published announcements"
  on public.announcements for select
  using (published = true);
