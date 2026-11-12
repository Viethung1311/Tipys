-- Existing pg_cron is shared with weekly stars. Closure is also checked on every API read/write.
begin;
select cron.schedule('zunimo-assessment-deadlines','* * * * *','select public.tipy_expire_assessments();');
commit;
