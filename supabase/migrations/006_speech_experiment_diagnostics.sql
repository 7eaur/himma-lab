alter table public.speech_experiment_runs
  add column if not exists audio_quality jsonb not null default '{}'::jsonb,
  add column if not exists asr_diagnostics jsonb not null default '{}'::jsonb;

comment on column public.speech_experiment_runs.audio_quality is
  'Non-academic technical audio preflight metrics for the speech lab.';

comment on column public.speech_experiment_runs.asr_diagnostics is
  'ASR source/status/script/fallback diagnostics for experiment evidence.';
