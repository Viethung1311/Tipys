import { readFileSync } from 'node:fs';
import { teacherFixture } from './teacher-fixture.js';
export async function hubFixture() {
  const f = await teacherFixture();
  await f.db.exec(readFileSync('supabase/migrations/20261119122457_classroom_hub.sql', 'utf8'));
  return f;
}
