alter table public.calibration_samples
  add column if not exists normalized_reference text,
  add column if not exists normalized_transcript text,
  add column if not exists alignment jsonb not null default '[]'::jsonb,
  add column if not exists correct_count integer,
  add column if not exists deletion_count integer,
  add column if not exists insertion_count integer,
  add column if not exists substitution_count integer,
  add column if not exists wer numeric,
  add column if not exists lexical_accuracy numeric,
  add column if not exists pronunciation_reference jsonb not null default '[]'::jsonb,
  add column if not exists human_observed_units jsonb not null default '[]'::jsonb,
  add column if not exists human_error_types jsonb not null default '[]'::jsonb,
  add column if not exists calibration_state text not null default 'not_calibrated' check (calibration_state in ('not_calibrated','calibration','validated')),
  add column if not exists analysis_version text not null default 'reference-guided-v1';

alter table public.calibration_reviews
  add column if not exists observed_units jsonb not null default '[]'::jsonb,
  add column if not exists error_types jsonb not null default '[]'::jsonb;

create index if not exists idx_calibration_samples_group_target on public.calibration_samples(target_group, target_key);
create index if not exists idx_calibration_samples_created on public.calibration_samples(created_at desc);
