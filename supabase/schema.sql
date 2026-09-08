-- ============================================================
-- ACT — Automated Content Transformation
-- Database schema, Row Level Security, and storage policies
-- Run this in the Supabase SQL editor (idempotent).
-- ============================================================

create extension if not exists "uuid-ossp";
-- pgvector is optional; embeddings fall back to lexical retrieval
-- create extension if not exists vector;

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('ADMIN', 'OPERATOR', 'REVIEWER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type processing_status as enum ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transformation_status as enum ('CONFIGURING', 'GENERATING', 'VERIFYING', 'READY', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type artifact_type as enum ('EXECUTIVE_SUMMARY', 'TECHNICAL_ADVISORY', 'SOCIAL_POST', 'PRESENTATION', 'VIDEO_PACKAGE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type artifact_status as enum ('DRAFT', 'GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status as enum ('VERIFIED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED', 'NEEDS_REVIEW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_status as enum ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role user_role not null default 'OPERATOR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filename text not null,
  file_type text not null,
  storage_path text not null,
  file_size bigint not null default 0,
  processing_status processing_status not null default 'UPLOADED',
  processing_error text,
  page_count integer,
  analysis jsonb,          -- structured source analysis (canonical source representation)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  section_title text,
  embedding jsonb,         -- optional; lexical retrieval is the fallback
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists transformations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_audience text not null,
  tone text not null,
  language text not null default 'English',
  detail_level text not null,
  communication_objective text not null,
  content_style text not null,
  output_types artifact_type[] not null default '{}',
  status transformation_status not null default 'CONFIGURING',
  stage text,              -- real progress stage for the UI
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists artifacts (
  id uuid primary key default uuid_generate_v4(),
  transformation_id uuid not null references transformations(id) on delete cascade,
  type artifact_type not null,
  title text not null,
  content text,
  structured_content jsonb,
  quality_score numeric,
  version integer not null default 1,
  status artifact_status not null default 'GENERATED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claims (
  id uuid primary key default uuid_generate_v4(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  claim_text text not null,
  claim_type text,
  verification_status claim_status not null default 'NEEDS_REVIEW',
  confidence_score numeric,
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists evidence (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  document_chunk_id uuid references document_chunks(id) on delete set null,
  relevance_score numeric,
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  status review_status not null default 'PENDING',
  comments text,
  reviewed_at timestamptz
);

create table if not exists artifact_versions (
  id uuid primary key default uuid_generate_v4(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  version_number integer not null,
  content text,
  structured_content jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  label text not null default 'AI Generated', -- AI Generated | Human Edited | Approved
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_project on documents(project_id);
create index if not exists idx_chunks_document on document_chunks(document_id);
create index if not exists idx_transformations_project on transformations(project_id);
create index if not exists idx_artifacts_transformation on artifacts(transformation_id);
create index if not exists idx_claims_artifact on claims(artifact_id);
create index if not exists idx_evidence_claim on evidence(claim_id);

-- ---------- Auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- Users can only access their own projects and everything
-- that cascades from them (documents, transformations,
-- artifacts, claims, evidence, reviews, versions).
-- ============================================================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table transformations enable row level security;
alter table artifacts enable row level security;
alter table claims enable row level security;
alter table evidence enable row level security;
alter table reviews enable row level security;
alter table artifact_versions enable row level security;

-- profiles: self (admins can list users)
drop policy if exists "profiles self select" on profiles;
create policy "profiles self select" on profiles for select
  using (id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles for update using (id = auth.uid());

-- projects: owner full access
drop policy if exists "projects owner all" on projects;
create policy "projects owner all" on projects for all
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- documents: via project ownership
drop policy if exists "documents owner all" on documents;
create policy "documents owner all" on documents for all
  using (exists (select 1 from projects p where p.id = project_id and p.created_by = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.created_by = auth.uid()));

-- document_chunks: via document -> project ownership
drop policy if exists "chunks owner all" on document_chunks;
create policy "chunks owner all" on document_chunks for all
  using (exists (
    select 1 from documents d join projects p on p.id = d.project_id
    where d.id = document_id and p.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from documents d join projects p on p.id = d.project_id
    where d.id = document_id and p.created_by = auth.uid()
  ));

-- transformations: via project ownership
drop policy if exists "transformations owner all" on transformations;
create policy "transformations owner all" on transformations for all
  using (exists (select 1 from projects p where p.id = project_id and p.created_by = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.created_by = auth.uid()));

-- artifacts: via transformation -> project ownership
drop policy if exists "artifacts owner all" on artifacts;
create policy "artifacts owner all" on artifacts for all
  using (exists (
    select 1 from transformations t join projects p on p.id = t.project_id
    where t.id = transformation_id and p.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from transformations t join projects p on p.id = t.project_id
    where t.id = transformation_id and p.created_by = auth.uid()
  ));

-- claims: via artifact ownership chain
drop policy if exists "claims owner all" on claims;
create policy "claims owner all" on claims for all
  using (exists (
    select 1 from artifacts a join transformations t on t.id = a.transformation_id
    join projects p on p.id = t.project_id
    where a.id = artifact_id and p.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from artifacts a join transformations t on t.id = a.transformation_id
    join projects p on p.id = t.project_id
    where a.id = artifact_id and p.created_by = auth.uid()
  ));

-- evidence: via claim ownership chain
drop policy if exists "evidence owner all" on evidence;
create policy "evidence owner all" on evidence for all
  using (exists (
    select 1 from claims c join artifacts a on a.id = c.artifact_id
    join transformations t on t.id = a.transformation_id join projects p on p.id = t.project_id
    where c.id = claim_id and p.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from claims c join artifacts a on a.id = c.artifact_id
    join transformations t on t.id = a.transformation_id join projects p on p.id = t.project_id
    where c.id = claim_id and p.created_by = auth.uid()
  ));

-- reviews: owner of the underlying artifact can read/insert;
-- a reviewer may only modify their own review rows.
drop policy if exists "reviews owner select" on reviews;
create policy "reviews owner select" on reviews for select
  using (exists (
    select 1 from artifacts a join transformations t on t.id = a.transformation_id
    join projects p on p.id = t.project_id
    where a.id = artifact_id and p.created_by = auth.uid()
  ));
drop policy if exists "reviews insert own" on reviews;
create policy "reviews insert own" on reviews for insert
  with check (reviewer_id = auth.uid() and exists (
    select 1 from artifacts a join transformations t on t.id = a.transformation_id
    join projects p on p.id = t.project_id
    where a.id = artifact_id and p.created_by = auth.uid()
  ));
drop policy if exists "reviews update own" on reviews;
create policy "reviews update own" on reviews for update
  using (reviewer_id = auth.uid());

-- artifact_versions: via artifact ownership chain
drop policy if exists "versions owner all" on artifact_versions;
create policy "versions owner all" on artifact_versions for all
  using (exists (
    select 1 from artifacts a join transformations t on t.id = a.transformation_id
    join projects p on p.id = t.project_id
    where a.id = artifact_id and p.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from artifacts a join transformations t on t.id = a.transformation_id
    join projects p on p.id = t.project_id
    where a.id = artifact_id and p.created_by = auth.uid()
  ));

-- ============================================================
-- Storage: private bucket "source-documents"
-- Path convention: {project_id}/{document_id}/{filename}
-- ============================================================
insert into storage.buckets (id, name, public)
values ('source-documents', 'source-documents', false)
on conflict (id) do nothing;

drop policy if exists "source docs upload" on storage.objects;
create policy "source docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'source-documents' and (storage.foldername(name))[1] in (
    select id::text from projects where created_by = auth.uid()
  ));

drop policy if exists "source docs select" on storage.objects;
create policy "source docs select" on storage.objects for select to authenticated
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] in (
    select id::text from projects where created_by = auth.uid()
  ));

drop policy if exists "source docs delete" on storage.objects;
create policy "source docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] in (
    select id::text from projects where created_by = auth.uid()
  ));

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists touch_projects on projects;
create trigger touch_projects before update on projects
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_documents on documents;
create trigger touch_documents before update on documents
  for each row execute function public.touch_updated_at();
drop trigger if exists touch_artifacts on artifacts;
create trigger touch_artifacts before update on artifacts
  for each row execute function public.touch_updated_at();
