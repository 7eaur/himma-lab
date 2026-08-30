alter table public.calibration_samples
  add column if not exists client_decoded_duration_ms integer,
  add column if not exists client_rms numeric,
  add column if not exists client_peak numeric,
  add column if not exists client_silence_ratio numeric;
