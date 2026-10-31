alter table public.speech_experiment_runs
  add column if not exists provider_feedback_verdict text
    check (provider_feedback_verdict is null or provider_feedback_verdict in ('accurate','inaccurate','unclear')),
  add column if not exists provider_feedback_observed_text text,
  add column if not exists provider_feedback_notes text,
  add column if not exists provider_feedback_at timestamptz;

comment on column public.speech_experiment_runs.provider_feedback_verdict is
  'Human review of Azure analysis fidelity, separate from student pronunciation correctness. Lab only.';
comment on column public.speech_experiment_runs.provider_feedback_observed_text is
  'Optional human correction of what the recorded speaker said when Azure analysis is inaccurate.';
comment on column public.speech_experiment_runs.provider_feedback_notes is
  'Reviewer notes on ASR and Pronunciation Assessment, independent of student verdict.';
comment on column public.speech_experiment_runs.provider_feedback_at is
  'Timestamp of reviewer evaluation of Azure analysis, no academic effect.';
