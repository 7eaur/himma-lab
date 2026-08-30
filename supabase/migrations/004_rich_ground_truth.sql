alter table public.calibration_participants
  add column if not exists dataset_split text not null default 'unassigned'
    check (dataset_split in ('unassigned','development','calibration','validation'));

alter table public.calibration_samples
  add column if not exists self_validity text not null default 'valid'
    check (self_validity in ('valid','silence','noisy','too_short','unclear','corrupt')),
  add column if not exists self_confidence text not null default 'medium'
    check (self_confidence in ('high','medium','low')),
  add column if not exists self_error_category text
    check (self_error_category is null or self_error_category in ('haraka','letter','deletion','insertion','shadda','sukun','tanween','unclear','other')),
  add column if not exists self_unsure_reason text
    check (self_unsure_reason is null or self_unsure_reason in ('cannot_distinguish','recording_quality','haraka_uncertain','letter_uncertain','other')),
  add column if not exists self_unit_annotations jsonb not null default '[]'::jsonb,
  add column if not exists dataset_split text not null default 'unassigned'
    check (dataset_split in ('unassigned','development','calibration','validation'));

alter table public.calibration_reviews
  add column if not exists validity text not null default 'valid'
    check (validity in ('valid','silence','noisy','too_short','unclear','corrupt')),
  add column if not exists error_category text
    check (error_category is null or error_category in ('haraka','letter','deletion','insertion','shadda','sukun','tanween','unclear','other')),
  add column if not exists unsure_reason text
    check (unsure_reason is null or unsure_reason in ('cannot_distinguish','recording_quality','haraka_uncertain','letter_uncertain','other')),
  add column if not exists unit_annotations jsonb not null default '[]'::jsonb;

create index if not exists idx_calibration_samples_split_target
  on public.calibration_samples(dataset_split, target_key, created_at desc);
