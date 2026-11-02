alter table public.speech_experiment_runs
  add column if not exists model_feedback_verdict text
    check (model_feedback_verdict is null or model_feedback_verdict in ('appropriate','inappropriate','unclear')),
  add column if not exists model_feedback_notes text,
  add column if not exists model_feedback_at timestamptz;

comment on column public.speech_experiment_runs.model_feedback_verdict is
  'Independent human assessment of the lab model decision, not the speech audio or provider transcript; no academic effect.';
comment on column public.speech_experiment_runs.model_feedback_notes is
  'Optional reviewer explanation of appropriateness of the recorded lab decision.';
comment on column public.speech_experiment_runs.model_feedback_at is
  'Human decision-review timestamp for evidence analysis.';
