alter table public.speech_experiment_runs
  add column if not exists content_version text,
  add column if not exists source_question_id text,
  add column if not exists question_group text;

update public.speech_experiment_runs
set content_version = 'legacy-speech-lab-202609'
where content_version is null;

create index if not exists idx_speech_experiment_runs_content_version
  on public.speech_experiment_runs (content_version, created_at desc);

create index if not exists idx_speech_experiment_runs_source_question
  on public.speech_experiment_runs (source_question_id, created_at desc);

comment on column public.speech_experiment_runs.content_version is
  'Immutable lab content snapshot identifier. New V2-62 runs use the exact Himma source HEAD snapshot.';

comment on column public.speech_experiment_runs.source_question_id is
  'Canonical Himma V2 question ID used by the speech experiment.';

comment on column public.speech_experiment_runs.question_group is
  'Canonical experiment group such as pretest, l1_lessons, l1_supports, etc.';
