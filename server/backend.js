/** Composition root: one server-only Supabase client, independent feature services. */
import { createClient } from '@supabase/supabase-js';
import { ApiError } from './errors.js';
import { createIdentity } from './modules/identity.js';
import { createGames } from './modules/games.js';
import { createClassrooms } from './modules/classrooms.js';
export { ApiError, requireAdmin } from './errors.js';
export { username, credential, emailFor } from './modules/identity.js';
export { validateLevels, validateProgress } from './modules/game-validation.js';
export const ready = (env) =>
  Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.TIPY_AUTH_SECRET?.length >= 32);
export function createBackend(env, clientFactory = createClient) {
  if (!ready(env))
    throw new ApiError(503, 'Phần tài khoản đang được thiết lập. Bạn vẫn có thể chơi thử.');
  const client = () =>
    clientFactory(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  const db = client();
  return { ...createIdentity({ db, client, env }), ...createGames(db), ...createClassrooms(db) };
}
