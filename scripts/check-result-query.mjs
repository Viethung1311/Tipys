import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const oldSQL = readFileSync('db/assessment_policies.sql', 'utf8').match(
  /create function public.tipy_assessment_results[\s\S]*?\$\$;/,
)[0];
const newSQL = readFileSync(
  'supabase/migrations/20261113042630_assessment_result_summary.sql',
  'utf8',
);
const exam = '00000000-0000-4000-8000-000000000001';
try {
  await db.exec(`create table profiles(user_id uuid primary key, full_name text, username text);
    create table classes(class_id uuid primary key,name text,archived_at timestamptz);
    create table class_members(class_id uuid,user_id uuid,is_active boolean);
    create table assessments(assessment_id uuid primary key,definition jsonb);
    create table assessment_assignments(assessment_id uuid,user_id uuid,allowed_attempts integer);
    create table assessment_attempts(attempt_id uuid default gen_random_uuid(),assessment_id uuid,user_id uuid,attempt_number integer,submitted_at timestamptz,active_seconds integer,results jsonb);
    create index attempts_lookup on assessment_attempts(assessment_id,user_id,attempt_number desc);
    insert into profiles select ('00000000-0000-4000-8001-'||lpad(n::text,12,'0'))::uuid,'Student '||lpad(n::text,2,'0'),'kid'||n from generate_series(1,30) n;
    insert into assessment_assignments select '${exam}',user_id,10 from profiles;
    insert into assessment_attempts(assessment_id,user_id,attempt_number,submitted_at,active_seconds,results)
    select '${exam}',p.user_id,n,timestamptz '2026-11-13 03:00:00+00',n,jsonb_build_array(jsonb_build_object('id','falling','title','Chữ rơi','type','falling','score',n*10,'accuracy',95)) from profiles p cross join generate_series(1,10) n;
    analyze;`);
  await db.query('insert into assessments values($1,$2)', [
    exam,
    {
      sections: [
        {
          type: 'quest',
          items: Array.from({ length: 327 }, (_, n) => ({ target: `Nội dung thử ${n}`, id: n })),
        },
      ],
    },
  ]);
  const measure = async (sql) => {
    await db.exec(sql);
    const data = (
      await db.query('select public.tipy_assessment_results($1,$2) data', [
        exam,
        { page: 1, sort: 'score_desc' },
      ])
    ).rows[0].data;
    const query = sql
      .match(/as \$\$([\s\S]*?)\$\$/)[1]
      .replaceAll('p_exam', '$1::uuid')
      .replaceAll('p_input', '$2::jsonb');
    const plan = (
      await db.query('explain (analyze, buffers, format json) ' + query, [
        exam,
        { page: 1, sort: 'score_desc' },
      ])
    ).rows[0]['QUERY PLAN'][0].Plan;
    let scanned = 0;
    const visit = (node) => {
      if (/Scan/.test(node['Node Type']) && !/CTE|Subquery/.test(node['Node Type']))
        scanned +=
          ((node['Actual Rows'] || 0) + (node['Rows Removed by Filter'] || 0)) *
          (node['Actual Loops'] || 0);
      for (const child of node.Plans || []) visit(child);
    };
    visit(plan);
    return { data, bytes: Buffer.byteLength(JSON.stringify(data)), scanRows: scanned };
  };
  const before = await measure(oldSQL),
    after = await measure(newSQL);
  assert.equal(after.data.items.length, 7);
  assert.equal(after.data.total, 30);
  assert.equal(after.bytes < before.bytes, true);
  assert.equal(after.scanRows < before.scanRows, true);
  const normalized = structuredClone(before.data);
  delete normalized.sections;
  for (const row of normalized.items) delete row.best_sections;
  assert.deepEqual(after.data, normalized);
  console.log(
    JSON.stringify({
      fixture: '30 students, 10 attempts each, 327 source items',
      before: { bytes: before.bytes, scanRows: before.scanRows },
      after: { bytes: after.bytes, scanRows: after.scanRows },
      identicalVisibleResults: true,
    }),
  );
} finally {
  await db.close();
}
