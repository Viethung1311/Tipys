/** Catalog, student summaries and bounded game results. */
import { questStart } from './keyboard-quest.js';
import { QUEST_CODE } from '../../src/features/keyboard-quest/curriculum.js';
import { SUPPORTED_KEYS } from '../../src/game/config.js';
import { resultRows } from '../../src/game/results.js';
import { ApiError, requireAdmin, fail } from '../errors.js';
import { validateLevels, validateProgress } from './game-validation.js';
import { uuid } from './classrooms.js';
export function createGames(db) {
  return {
    async games(admin = false) {
      const query = db.from('games').select('*').order('created_at');
      const { data, error } = await (admin ? query : query.eq('is_active', true));
      fail(error);
      return data;
    },
    async history(profile, { userId } = {}) {
      if (userId !== undefined) {
        requireAdmin(profile);
        uuid(userId);
        const student = await db
          .from('profiles')
          .select('user_id')
          .eq('user_id', userId)
          .eq('role', 'student')
          .maybeSingle();
        fail(student.error);
        if (!student.data) throw new ApiError(404, 'Không tìm thấy học sinh.');
      }
      let query = db
        .from('player_game_stats')
        .select('*,games(game_code,game_name),profiles(username,full_name)')
        .order('last_played_at', { ascending: false })
        .limit(200);
      if (userId !== undefined || profile.role !== 'admin')
        query = query.eq('user_id', userId ?? profile.user_id);
      const { data, error } = await query;
      fail(error);
      return resultRows(data);
    },
    async students(profile) {
      requireAdmin(profile);
      const { data, error } = await db
        .from('profiles')
        .select(
          'user_id,username,full_name,role,is_active,created_at,class_members(class_id,is_active,classes(class_id,name,archived_at)),player_game_stats(total_active_seconds,total_plays,last_played_at)',
        )
        .eq('role', 'student')
        .order('created_at', { ascending: false })
        .limit(200);
      fail(error);
      return data
        .map((student) => ({
          ...student,
          total_active_seconds: student.player_game_stats.reduce(
            (n, s) => n + Number(s.total_active_seconds),
            0,
          ),
          total_plays: student.player_game_stats.reduce((n, s) => n + Number(s.total_plays), 0),
        }))
        .sort((a, b) => b.total_active_seconds - a.total_active_seconds);
    },
    async studentUpdate(profile, input) {
      requireAdmin(profile);
      if (typeof input.active !== 'boolean') throw new ApiError(400, 'Trạng thái chưa hợp lệ.');
      const { data, error } = await db
        .from('profiles')
        .update({ is_active: input.active })
        .eq('user_id', input.userId)
        .eq('role', 'student')
        .select('user_id,is_active')
        .single();
      fail(error);
      return data;
    },
    async saveGame(profile, input) {
      requireAdmin(profile);
      const code = String(input.gameCode ?? '');
      if (!/^[a-z][a-z0-9_]{0,49}$/.test(code))
        throw new ApiError(400, 'Mã game dùng chữ thường, số và gạch dưới.');
      const name = String(input.name ?? '').trim();
      if (!name || name.length > 100)
        throw new ApiError(400, 'Bạn nhập tên game tối đa 100 ký tự.');
      if (!input.config || typeof input.config !== 'object' || Array.isArray(input.config))
        throw new ApiError(400, 'Cấu hình game phải là một đối tượng JSON.');
      if (code === 'falling_letters') validateLevels(input.config.levels);
      const { data, error } = await db
        .from('games')
        .upsert(
          {
            game_code: code,
            game_name: name,
            engine_code: String(input.engineCode || code).slice(0, 50),
            description: String(input.description || '').slice(0, 1000),
            is_active: input.active !== false,
            config: input.config,
          },
          { onConflict: 'game_code' },
        )
        .select()
        .single();
      fail(error);
      return data;
    },
    async start(profile, input) {
      const { data: game, error } = await db
        .from('games')
        .select('*')
        .eq('game_code', input.gameCode)
        .eq('is_active', true)
        .single();
      fail(error, 'Trò chơi chưa được mở.');
      if (game.engine_code === QUEST_CODE) {
        if (game.game_code !== QUEST_CODE) throw new ApiError(400, 'Mã game chưa hợp lệ.');
        return questStart(db, profile, game, input);
      }
      if (input.ranked !== undefined && typeof input.ranked !== 'boolean')
        throw new ApiError(400, 'Kiểu chơi chưa hợp lệ.');
      if (input.ranked) {
        if (game.game_code !== 'falling_letters' || game.engine_code !== 'falling_letters')
          throw new ApiError(400, 'Game chưa có xếp hạng tuần.');
        const result = await db.rpc('tipy_begin_ranked', {
          p_user: profile.user_id,
          p_game: game.game_id,
        });
        fail(result.error, 'Chưa bắt đầu được lượt xếp hạng tuần.');
        return result.data;
      }
      const difficulty = input.difficulty ?? null;
      if (
        difficulty !== null &&
        (!/^[a-z0-9_-]{1,40}$/.test(difficulty) || !game.config?.levels?.[difficulty])
      )
        throw new ApiError(400, 'Độ khó chưa hợp lệ.');
      const keys = Array.isArray(input.keys) ? [...new Set(input.keys)] : [];
      if (keys.some((k) => !SUPPORTED_KEYS.has(k))) throw new ApiError(400, 'Bộ phím chưa hợp lệ.');
      if (game.engine_code === 'falling_letters' && !keys.length)
        throw new ApiError(400, 'Bạn chọn ít nhất một phím nhé.');
      const stage = input.stageNumber ?? null;
      if (stage !== null && (!Number.isInteger(stage) || stage < 1 || stage > 100000))
        throw new ApiError(400, 'Số màn chưa hợp lệ.');
      const { data, error: insertError } = await db.rpc('tipy_begin_play', {
        p_user: profile.user_id,
        p_game: game.game_id,
        p_difficulty: difficulty,
        p_keys: keys,
        p_config: game.config,
        p_stage: stage,
      });
      fail(insertError);
      return data;
    },
    async progress(profile, input) {
      const { data: play, error } = await db
        .from('active_plays')
        .select('*,games(engine_code)')
        .eq('play_id', input.playId)
        .eq('user_id', profile.user_id)
        .single();
      fail(error, 'Không tìm thấy lượt chơi của bạn.');
      if (play.result !== 'in_progress') return play; // Retrying a final save is idempotent.
      const values = validateProgress(play, input);
      const { data, error: updateError } = await db.rpc('tipy_save_play', {
        p_user: profile.user_id,
        p_play: play.play_id,
        p_values: values,
      });
      fail(updateError);
      return data || play;
    },
  };
}
