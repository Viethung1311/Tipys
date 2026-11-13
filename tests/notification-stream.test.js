import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createNotificationEvents } from '../api/notification-events.js';
import { createNotifications } from '../server/modules/notifications.js';
import { id } from './notifications-fixture.js';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
test('notification stream scopes one subscription, batches bursts, stays idle without reads and cleans up', async () => {
  const profile = { user_id: id(1), role: 'student' };
  let channelFilters,
    removed = 0,
    disconnected = 0;
  const channel = {
    on(event, filters, fn) {
      channelFilters = filters;
      return this;
    },
    subscribe() {
      return this;
    },
  };
  const service = createNotifications({
    channel: () => channel,
    removeChannel: async (c) => {
      assert.equal(c, channel);
      removed++;
    },
    realtime: {
      disconnect() {
        disconnected++;
      },
    },
  });
  const stop = service.watchNotifications(
    profile,
    () => {},
    () => {},
  );
  assert.equal(channelFilters.filter, `user_id=eq.${id(1)}`);
  assert.equal(channelFilters.event, 'INSERT');
  await stop();
  assert.equal(removed, 1);
  assert.equal(disconnected, 1);
  let changes,
    reads = 0,
    stops = 0;
  const handler = createNotificationEvents({
    heartbeat: 50,
    lifetime: 5000,
    makeBackend: () => ({
      session: async () => ({ profile }),
      notifications: async () => {
        reads++;
        return { items: [], unread: 0, page: 1, pages: 1, total: 0 };
      },
      watchNotifications(p, change, status) {
        assert.equal(p.user_id, id(1));
        changes = change;
        status('SUBSCRIBED');
        return async () => {
          stops++;
        };
      },
    }),
  });
  const req = new EventEmitter();
  Object.assign(req, {
    method: 'GET',
    headers: { cookie: 'tipy_access=fixture' },
    query: { userId: id(2) },
  });
  const res = new EventEmitter();
  const chunks = [];
  Object.assign(res, {
    setHeader() {},
    flushHeaders() {
      this.headersSent = true;
    },
    write(value) {
      chunks.push(value);
    },
    end() {
      this.emit('close');
    },
  });
  const running = handler(req, res);
  await wait(250);
  assert.equal(reads, 1);
  assert.ok(chunks.some((s) => s.includes('event: snapshot')));
  await wait(250);
  assert.equal(reads, 1, 'heartbeats do not query the database');
  changes();
  changes();
  changes();
  await wait(250);
  assert.equal(reads, 2, 'one refresh per burst');
  req.emit('aborted');
  await running;
  assert.equal(stops, 1);
  const count = chunks.length;
  changes();
  await wait(200);
  assert.equal(chunks.length, count);
});
test('notification stream denies guests and administrators before subscribing', async () => {
  for (const role of ['guest', 'admin']) {
    let subscriptions = 0;
    const handler = createNotificationEvents({
      makeBackend: () => ({
        session: async () => {
          if (role === 'guest') throw Object.assign(Error(), { status: 401 });
          return { profile: { role, user_id: id(1) } };
        },
        watchNotifications() {
          subscriptions++;
        },
      }),
    });
    const res = {
      setHeader() {},
      status(code) {
        this.code = code;
        return this;
      },
      json() {},
    };
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.code, role === 'guest' ? 401 : 403);
    assert.equal(subscriptions, 0);
  }
});

test('closing the tab during authentication never leaves a late Realtime subscription', async () => {
  let release,
    subscriptions = 0;
  const handler = createNotificationEvents({
    makeBackend: () => ({
      session: () =>
        new Promise((r) => {
          release = r;
        }),
      watchNotifications() {
        subscriptions++;
        return async () => {};
      },
    }),
  });
  const req = new EventEmitter();
  Object.assign(req, { method: 'GET', headers: {} });
  const res = new EventEmitter();
  Object.assign(res, { end() {}, setHeader() {} });
  const run = handler(req, res);
  res.emit('close');
  release({ profile: { user_id: id(1), role: 'student' } });
  await run;
  assert.equal(subscriptions, 0);
});
