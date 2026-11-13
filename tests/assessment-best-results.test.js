import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { starFixture, id } from './star-balance-fixture.js';

test('best submitted sections select 50→80→60, retain first tie metadata, old history and seven-row sorted pages', async () => {
  const f = await starFixture();
  try {
    assert.equal(
      readFileSync('db/assessment_best_results.sql', 'utf8'),
      readFileSync('supabase/migrations/20261113170956_assessment_best_results.sql', 'utf8'),
    );
    for (const file of [
      'assessments',
      'assessment_policies',
      'assessment_class_access',
      'assessment_best_results',
    ])
      await f.db.exec(readFileSync(`db/${file}.sql`, 'utf8'));
    const sections = [
      { id: 'fall', title: 'Chữ rơi', type: 'falling' },
      { id: 'quest', title: 'Bài học', type: 'quest' },
    ];
    await f.db.query(
      "insert into assessments(assessment_id,created_by,definition,status) values($1,$2,$3,'published')",
      [id(800), id(99), { title: 'Bài nhiều phần', sections }],
    );
    for (let n = 1; n <= 15; n++) {
      if (n > 7)
        await f.db.query('insert into auth.users values($1,$2,$3)', [
          id(n),
          { username: `fixture${n}`, full_name: `Học sinh thử ${n}` },
          {},
        ]);
      await f.db.query(
        'insert into assessment_assignments(assessment_id,user_id,direct,allowed_attempts) values($1,$2,true,8)',
        [id(800), id(n)],
      );
    }
    const seed = async (user, number, score, accuracy, submitted = true) => {
      const results = [
        { ...sections[0], score, accuracy: 50 + number, completed: true, seconds: number * 10 },
        {
          ...sections[1],
          accuracy,
          correct: accuracy,
          total: 100,
          completed: number !== 3,
          seconds: number * 5,
        },
      ];
      return await f.q(
        'insert into assessment_attempts(assessment_id,user_id,attempt_number,definition,submitted_at,active_seconds,results) values($1,$2,$3,$4,$5,$6,$7) returning *',
        [
          id(800),
          id(user),
          number,
          { sections },
          submitted ? `2026-11-10T0${number}:00:00Z` : null,
          number * 17,
          results,
        ],
      );
    };
    await seed(1, 1, 50, 95);
    const winner = await seed(1, 2, 80, 75);
    await seed(1, 3, 60, 99);
    await seed(1, 4, 80, 100);
    await seed(1, 5, 9999, 100, false);
    await seed(2, 1, 90, 50);
    await seed(2, 2, 10, 50);
    const best = (await f.q('select tipy_assessment_best($1,$2) r', [id(800), id(1)])).r;
    assert.equal(best[0].score, 80);
    assert.equal(best[0].attempt_id, winner.attempt_id);
    assert.equal(best[0].active_seconds, 34);
    assert.equal(Date.parse(best[0].submitted_at), winner.submitted_at.getTime());
    assert.equal(best[1].accuracy, 100);
    assert.equal(best[1].attempt_number, 4);
    assert.equal(best[1].seconds, 20);
    const page = (
      await f.q('select tipy_assessment_results($1,$2) r', [
        id(800),
        { sort: 'score_desc', page: 1 },
      ])
    ).r;
    assert.equal(page.items.length, 7);
    assert.equal(page.total, 15);
    assert.equal(page.pages, 3);
    assert.equal(page.items[0].user_id, id(2));
    assert.equal(page.items[1].user_id, id(1));
    assert.equal(page.items[1].best_sections[0].attempt_number, 2);
    assert.equal(page.items[1].attempt_count, 5);
    assert.equal(page.items[1].attempt_status, 'in_progress');
    const last = (
      await f.q('select tipy_assessment_results($1,$2) r', [
        id(800),
        { sort: 'score_desc', page: 3 },
      ])
    ).r;
    assert.equal(last.items.length, 1);
    const history = (
      await f.q("select tipy_assessment($1,'attempts',$2) r", [id(1), { assessmentId: id(800) }])
    ).r;
    assert.equal(history.items.length, 5);
    assert.equal(history.best_sections[0].score, 80);
    await f.db.exec('set role authenticated');
    await assert.rejects(
      f.q('select tipy_assessment_best($1,$2)', [id(800), id(1)]),
      /permission denied/,
    );
    await f.db.exec('reset role');
  } finally {
    await f.db.close();
  }
});
