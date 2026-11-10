-- Preserve ownership, metadata and RLS; legacy codes remain valid for open tabs/rollback.
-- New API writes only catalog IDs; all readers normalize legacy records.
begin;
alter table public.student_avatars drop constraint if exists student_avatars_animal_check;
update public.student_avatars set animal=case animal when 'rat' then 'icon_01' when 'ox' then 'icon_04' when 'tiger' then 'icon_10' when 'cat' then 'icon_24' when 'dragon' then 'icon_29' when 'snake' then 'icon_18' when 'horse' then 'icon_23' when 'goat' then 'icon_14' when 'monkey' then 'icon_06' when 'rooster' then 'icon_02' when 'dog' then 'icon_22' when 'pig' then 'icon_20' else animal end;
alter table public.student_avatars alter column animal set default 'icon_01';
alter table public.student_avatars add constraint student_avatars_animal_check check(animal in ('icon_01','icon_02','icon_03','icon_04','icon_05','icon_06','icon_07','icon_08','icon_09','icon_10','icon_11','icon_12','icon_13','icon_14','icon_15','icon_16','icon_17','icon_18','icon_19','icon_20','icon_21','icon_22','icon_23','icon_24','icon_25','icon_26','icon_27','icon_28','icon_29','icon_30','icon_31','icon_32','icon_33','icon_34','icon_35','icon_36','rat','ox','tiger','cat','dragon','snake','horse','goat','monkey','rooster','dog','pig'));
commit;
