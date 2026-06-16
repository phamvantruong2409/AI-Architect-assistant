-- ============================================================
-- AI Architect Assistant — Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable pgvector extension (required for Module 3 embeddings)
create extension if not exists vector;

-- ============================================================
-- MODULE 1: Design Briefing AI
-- ============================================================

create table if not exists briefing_projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  client_name   text not null,
  client_token  text unique not null default gen_random_uuid()::text,
  status        text not null default 'pending', -- pending | active | completed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists briefing_quiz_sessions (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references briefing_projects(id) on delete cascade,
  selected_images  jsonb not null default '[]',
  style_scores     jsonb not null default '{}',
  family_size      integer not null default 1,
  family_members   jsonb not null default '[]',
  lifestyle_habits jsonb not null default '{}',
  budget_range     text not null default '500m_1b',
  free_text_notes  text,
  completed_at     timestamptz not null default now()
);

create table if not exists briefing_design_briefs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references briefing_projects(id) on delete cascade unique,
  dominant_style      text,
  style_breakdown     jsonb not null default '{}',
  color_palette       jsonb not null default '[]',
  material_preferences jsonb not null default '[]',
  lighting_preference text,
  design_constraints  jsonb not null default '[]',
  space_requirements  jsonb not null default '[]',
  ai_summary          text,
  kts_notes           text,
  generated_at        timestamptz not null default now(),
  gemini_model        text
);

-- ============================================================
-- MODULE 2: Regulatory Check AI
-- ============================================================

create table if not exists reg_checks (
  id              uuid primary key default gen_random_uuid(),
  project_name    text not null,
  project_address text not null default '',
  building_type   text not null,
  zoning_type     text not null,
  land_area       numeric(10,2) not null default 0,
  land_width      numeric(6,2) not null default 0,
  land_depth      numeric(6,2) not null default 0,
  floors          integer not null default 1,
  total_height    numeric(6,2) not null default 0,
  building_area   numeric(10,2) not null default 0,
  total_floor_area numeric(10,2) not null default 0,
  setback_front   numeric(6,2) not null default 0,
  setback_rear    numeric(6,2) not null default 0,
  setback_left    numeric(6,2) not null default 0,
  setback_right   numeric(6,2) not null default 0,
  corridor_width  numeric(6,2) not null default 0,
  window_ratio    numeric(6,2) not null default 0,
  extra_notes     text not null default '',
  status          text not null default 'analyzing', -- analyzing | completed | error
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists reg_reports (
  id                 uuid primary key default gen_random_uuid(),
  check_id           uuid references reg_checks(id) on delete cascade unique,
  overall_score      integer,
  compliance_summary text,
  violations         jsonb not null default '[]',
  passed_checks      jsonb not null default '[]',
  kts_notes          text,
  gemini_model       text,
  generated_at       timestamptz not null default now()
);

-- ============================================================
-- MODULE 3: Knowledge Base AI
-- ============================================================

create table if not exists knowledge_documents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  file_type     text not null, -- pdf | docx | txt
  category      text not null default 'general', -- TCVN | QCVN | PCCC | general
  content       text,
  chunk_count   integer default 0,
  status        text not null default 'pending', -- pending | processing | ready | error
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references knowledge_documents(id) on delete cascade,
  document_name text not null,
  content       text not null,
  embedding     vector(768),
  chunk_index   integer not null,
  category      text not null default 'general',
  created_at    timestamptz not null default now()
);

-- Index for fast vector similarity search
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC function for semantic similarity search
create or replace function match_knowledge_chunks(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count     int default 8,
  filter_category text default null
)
returns table (
  id            uuid,
  document_id   uuid,
  document_name text,
  content       text,
  category      text,
  similarity    float
)
language sql stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.document_name,
    kc.content,
    kc.category,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where
    (filter_category is null or kc.category = filter_category)
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Row Level Security (optional — enable if using auth)
-- ============================================================
-- alter table briefing_projects enable row level security;
-- alter table briefing_quiz_sessions enable row level security;
-- alter table briefing_design_briefs enable row level security;
-- alter table reg_checks enable row level security;
-- alter table reg_reports enable row level security;
-- alter table knowledge_documents enable row level security;
-- alter table knowledge_chunks enable row level security;
