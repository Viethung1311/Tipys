import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../api/tipy.js';
import { ApiError } from '../server/errors.js';

test('authenticated file endpoint streams 5 MB without signed redirects or cache and denies the next request after removal', async () => {
  let allowed = true,
    signedIn = true,
    calls = 0;
  const body = new Uint8Array(5 * 1024 * 1024).fill(65);
  const handler = createHandler({
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      TIPY_AUTH_SECRET: 'x'.repeat(40),
    },
    makeBackend: () => ({
      session: async () => {
        if (!signedIn) throw new ApiError(401, 'Đăng nhập trước');
        return { profile: { user_id: 'student', role: 'student' } };
      },
      classDownload: async (profile, input) => {
        calls++;
        assert.equal(profile.role, 'student');
        assert.equal(input.attachmentId, 'file');
        if (!allowed) throw new ApiError(403, 'Bạn chưa được thêm vào lớp này.');
        return { blob: new Blob([body]), mime: 'application/pdf', name: 'Bài học.pdf' };
      },
    }),
  });
  const server = createServer((req, res) => {
    req.query = Object.fromEntries(new URL(req.url, 'http://test').searchParams);
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => res.end(JSON.stringify(data));
    handler(req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/?action=class_download&attachmentId=file`;
    let response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('location'), null);
    assert.match(response.headers.get('content-disposition'), /attachment/);
    assert.equal((await response.arrayBuffer()).byteLength, body.length);
    allowed = false;
    response = await fetch(url);
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /thêm vào lớp/);
    signedIn = false;
    response = await fetch(url);
    assert.equal(response.status, 401);
    assert.equal(calls, 2);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
