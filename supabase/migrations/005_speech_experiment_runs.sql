create table if not exists public.speech_experiment_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  participant_code text not null,
  test_key text not null,
  speech_mode text not null
    check (speech_mode in ('targeted_pronunciation','lexical','fluency')),
  pronunciation_focus text,
  reference_text text not null,
  audio_storage_path text,
  mime_type text,
  byte_size bigint,
  duration_ms integer,
  asr_provider text,
  asr_locale text,
  asr_transcript text,
  asr_confidence numeric,
  asr_error text,
  reading_analysis jsonb not null default '{}'::jsonb,
  alias_evidence jsonb not null default '{}'::jsonb,
  pronunciation_evidence jsonb,
  decision_state text not null
    check (decision_state in ('correct','incorrect','retry_required')),
  decision_reason text not null,
  feedback_verdict text
    check (feedback_verdict is null or feedback_verdict in ('correct','incorrect','unclear')),
  feedback_observed_text text,
  feedback_notes text,
  feedback_at timestamptz
);

alter table public.speech_experiment_runs enable row level security;

create index if not exists speech_experiment_runs_created_at_idx
  on public.speech_experiment_runs (created_at desc);

create index if not exists speech_experiment_runs_test_key_idx
  on public.speech_experiment_runs (test_key);

comment on table public.speech_experiment_runs is
  'Lab-only evidence for the simplified Himma speech experiment. No academic effect.';
