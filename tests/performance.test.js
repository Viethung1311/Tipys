import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClassrooms, classMembersView } from '../server/modules/classrooms.js';
import { api } from '../src/game/backend.js';
import { imagePreview } from '../src/features/classroom/image.js';
const classId = '22222222-2222-4222-8222-222222222222';

test('posts-only pagination checks membership and never reads player statistics', async () => {
  const tables = [],
    ranges = [];
  let member = false;
  const db = {
    from(table) {
      tables.push(table);
      const query = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        order() {
          return this;
        },
        maybeSingle: async () => ({
          data:
            table === 'classes' ? { class_id: classId } : member ? { user_id: 'student' } : null,
        }),
        range: async (a, b) => {
          ranges.push([a, b]);
          return { data: [{ post_id: 'p' }] };
        },
      };
      return query;
    },
  };
  const service = createClassrooms(db),
    profile = { user_id: 'student', role: 'student' };
  await assert.rejects(
    service.classPosts(profile, { classId, offset: 20 }),
    (e) => e.status === 403,
  );
  assert.equal(tables.includes('class_posts'), false);
  member = true;
  assert.deepEqual(await service.classPosts(profile, { classId, offset: 20 }), {
    posts: [{ post_id: 'p' }],
  });
  assert.deepEqual(ranges, [[20, 39]]);
  assert.equal(tables.includes('player_game_stats'), false);
  assert.equal(
    classMembersView([
      {
        user_id: 'student',
        profiles: {
          full_name: 'An',
          player_game_stats: [
            { best_score: 500, total_active_seconds: 12, games: { game_code: 'falling_letters' } },
          ],
        },
      },
    ])[0].best_score,
    500,
  );
});

test('concurrent identical GETs share one request and do not become permanent cache', async () => {
  const original = globalThis.fetch;
  let calls = 0,
    finish;
  globalThis.fetch = () => {
    calls++;
    return new Promise((resolve) => {
      finish = () => resolve({ ok: true, json: async () => ({ ok: true }) });
    });
  };
  try {
    const a = api('class_posts', undefined, { classId }),
      b = api('class_posts', undefined, { classId });
    assert.equal(calls, 1);
    finish();
    await Promise.all([a, b]);
    const c = api('class_posts', undefined, { classId });
    assert.equal(calls, 2);
    finish();
    await c;
  } finally {
    globalThis.fetch = original;
  }
});

test('preview scales large images, preserves original and closes decoded bitmap', async () => {
  const originals = {
    createImageBitmap: globalThis.createImageBitmap,
    document: globalThis.document,
  };
  let closed = false,
    dimensions;
  globalThis.createImageBitmap = async () => ({
    width: 4000,
    height: 2000,
    close() {
      closed = true;
    },
  });
  const canvas = {
    getContext: () => ({
      drawImage() {
        dimensions = [canvas.width, canvas.height];
      },
    }),
    toBlob: (resolve) => resolve(new Blob(['small'], { type: 'image/webp' })),
  };
  globalThis.document = { createElement: () => canvas };
  const file = new File([new Uint8Array(200000)], 'original.jpg', { type: 'image/jpeg' });
  try {
    const preview = await imagePreview(file);
    assert.deepEqual(dimensions, [960, 480]);
    assert.equal(preview.type, 'image/webp');
    assert.ok(preview.size < file.size);
    assert.equal(file.size, 200000);
    assert.equal(file.name, 'original.jpg');
    assert.equal(closed, true);
    assert.equal(await imagePreview(new File(['pdf'], 'a.pdf', { type: 'application/pdf' })), null);
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
import { createHandler } from '../api/tipy.js';

test('bootstrap starts independent catalog and classes reads together', async () => {
  const started = [];
  let release;
  const blocker = new Promise((resolve) => {
    release = resolve;
  });
  const handler = createHandler({
    env: {
      SUPABASE_URL: 'https://example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      TIPY_AUTH_SECRET: 'x'.repeat(32),
    },
    makeBackend: () => ({
      session: async () => ({ profile: { user_id: 'student', role: 'student' } }),
      games: async () => {
        started.push('games');
        await blocker;
        return [];
      },
      classes: async () => {
        started.push('classes');
        return [];
      },
    }),
  });
  let body;
  const res = {
    setHeader() {},
    status() {
      return this;
    },
    json(value) {
      body = value;
    },
  };
  const pending = handler(
    { method: 'GET', headers: { cookie: 'tipy_access=test' }, query: { action: 'bootstrap' } },
    res,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ['games', 'classes']);
  release();
  await pending;
  assert.equal(body.user.user_id, 'student');
});

test('original and preview links require current membership and reject archived posts', async () => {
  let member = false,
    archived = false;
  const signed = [];
  const db = {
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        not() {
          return this;
        },
        is() {
          return this;
        },
        single: async () => ({
          data: {
            class_id: classId,
            storage_path: 'class/image.previewable.jpg',
            name: 'a.jpg',
            mime_type: 'image/jpeg',
            class_posts: { archived_at: archived ? 'today' : null },
          },
        }),
        maybeSingle: async () => ({
          data:
            table === 'classes' ? { class_id: classId } : member ? { user_id: 'student' } : null,
        }),
      };
    },
    storage: {
      from() {
        return {
          createSignedUrl: async (path, ttl) => {
            signed.push([path, ttl]);
            return { data: { signedUrl: 'https://files.test/' + path } };
          },
        };
      },
    },
  };
  const service = createClassrooms(db),
    profile = { user_id: 'student', role: 'student' },
    input = { attachmentId: classId };
  await assert.rejects(service.classFile(profile, input), (e) => e.status === 403);
  assert.equal(signed.length, 0);
  member = true;
  const result = await service.classFile(profile, input);
  assert.ok(result.previewUrl.endsWith('.jpg.webp'));
  assert.ok(result.url.endsWith('.jpg'));
  assert.deepEqual(
    signed.map((x) => x[1]),
    [300, 300],
  );
  archived = true;
  await assert.rejects(service.classFile(profile, input), (e) => e.status === 404);
  assert.equal(signed.length, 2);
});
