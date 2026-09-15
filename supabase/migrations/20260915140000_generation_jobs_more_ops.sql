-- 0009_generation_jobs_more_ops.sql
-- Widen generation_jobs to the two other AI calls with the same failure mode as question
-- generation: a real request that can run past Netlify's 10-second limit on a synchronous
-- function.
--
-- Mock defense answer marking was the one actually reported broken - checked ai_usage and
-- found no row at all for the attempt, the same signature as the original questions bug
-- (the process logging the failure was the one being killed, so nothing was ever written).
-- Memory aids generation has not failed yet, but its one real historical sample ran 8.8
-- seconds - close enough to the same wall that it is the same bug waiting to happen, not a
-- different one.

alter table public.generation_jobs drop constraint if exists generation_jobs_operation_check;
alter table public.generation_jobs add constraint generation_jobs_operation_check
  check (operation in ('questions', 'mnemonics', 'evaluate'));
