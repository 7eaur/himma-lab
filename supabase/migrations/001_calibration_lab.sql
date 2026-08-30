create extension if not exists pgcrypto;

create table if not exists public.calibration_participants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.calibration_samples (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.calibration_participants(id) on delete restrict,
  target_key text not null,
  target_text text not null,
  target_type text not null,
  target_group text not null,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  client_duration_ms integer,
  self_verdict text not null check (self_verdict in ('correct','incorrect','unsure')),
  self_observed_text text,
  self_quality text not null check (self_quality in ('good','noisy','too_short','silence','unclear')),
  self_notes text,
  asr_provider text,
  asr_locale text,
  asr_transcript text,
  asr_confidence numeric,
  asr_duration_seconds numeric,
  asr_words jsonb not null default '[]'::jsonb,
  asr_request_id text,
  asr_error text,
  academic_effect text not null default 'none' check (academic_effect = 'none'),
  created_at timestamptz not null default now()
);

create table if not exists public.calibration_reviews (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.calibration_samples(id) on delete cascade,
  reviewer_slot smallint not null default 1 check (reviewer_slot between 1 and 3),
  verdict text not null check (verdict in ('correct','incorrect','unsure','invalid')),
  observed_text text,
  quality text not null check (quality in ('good','noisy','too_short','silence','unclear','corrupt')),
  reviewer_confidence text not null check (reviewer_confidence in ('high','medium','low')),
  notes text,
  created_at timestamptz not null default now(),
  unique(sample_id, reviewer_slot)
);

create index if not exists idx_calibration_samples_target on public.calibration_samples(target_key, created_at desc);
create index if not exists idx_calibration_samples_participant on public.calibration_samples(participant_id, created_at desc);
create index if not exists idx_calibration_reviews_sample on public.calibration_reviews(sample_id);

alter table public.calibration_participants enable row level security;
alter table public.calibration_samples enable row level security;
alter table public.calibration_reviews enable row level security;

-- لا ننشئ سياسات عامة. التطبيق يصل لهذه الجداول من API server-side عبر service role فقط.

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do update set public = excluded.public;
