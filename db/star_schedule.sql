-- UTC 17:05 is 00:05 Asia/Ho_Chi_Minh. Daily recovery also settles missed weeks.
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('zunimo-weekly-stars','5 17 * * *','select public.tipy_close_star_weeks();');
commit;
