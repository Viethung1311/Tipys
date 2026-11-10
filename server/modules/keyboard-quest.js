import { ApiError, fail } from '../errors.js';
import {
  QUEST_CODE,
  CURRICULUM_VERSION,
  findLesson,
  lessonForStage,
  isUnlocked,
} from '../../src/features/keyboard-quest/curriculum.js';
import { gradeLesson, matchesTarget } from '../../src/features/keyboard-quest/engine.js';
const fields =
  'lesson_id,completed,best_stars,best_accuracy,last_accuracy,weak_keys,weak_rules,last_play_id,last_played_at';
export async function questRows(db, userId, gameId) {
  const result = await db
    .from('player_lesson_progress')
    .select(fields)
    .eq('user_id', userId)
    .eq('game_id', gameId);
  fail(result.error, 'Chưa mở được tiến độ bài học. Bạn thử lại nhé.');
  return result.data;
}
export async function questStart(db, profile, game, input) {
  const lesson = lessonForStage(input.stageNumber);
  if (!lesson || input.lessonId !== lesson.id) throw new ApiError(400, 'Bài học chưa hợp lệ.');
  if (!isUnlocked(lesson, await questRows(db, profile.user_id, game.game_id)))
    throw new ApiError(403, 'Hoàn thành bài trước để mở bài này nhé.');
  const result = await db.rpc('tipy_begin_play', {
    p_user: profile.user_id,
    p_game: game.game_id,
    p_difficulty: null,
    p_keys: [],
    p_stage: lesson.stage,
    p_config: { ...game.config, curriculum_version: CURRICULUM_VERSION, lesson_id: lesson.id },
  });
  fail(result.error);
  return result.data;
}
export function validateQuestFinish(play, input) {
  const lesson = findLesson(play.metrics?.config_snapshot?.lesson_id);
  if (
    !lesson ||
    play.stage_number !== lesson.stage ||
    play.metrics.config_snapshot.curriculum_version !== CURRICULUM_VERSION
  )
    throw new ApiError(409, 'Bài học đã đổi. Bạn mở lại bài nhé.');
  const rows = input.answers;
  if (!Array.isArray(rows) || rows.length !== lesson.items.length)
    throw new ApiError(400, 'Bài luyện chưa hoàn tất.');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (
      !row ||
      row.itemId !== lesson.items[i].id ||
      typeof row.answer !== 'string' ||
      !matchesTarget(row.answer, lesson.items[i].target) ||
      !['errors', 'position', 'telex', 'editing'].every(
        (key) => Number.isInteger(row[key]) && row[key] >= 0 && row[key] <= 10000,
      ) ||
      row.errors !== row.position + row.telex + row.editing ||
      (lesson.kind === 'key' && row.errors !== row.position) ||
      (lesson.kind === 'text' && row.position !== 0) ||
      (!lesson.telex && row.telex !== 0)
    )
      throw new ApiError(400, 'Kết quả bài luyện chưa hợp lệ.');
  }
  return { lesson, grade: gradeLesson(lesson, rows) };
}
export function createKeyboardQuest(db) {
  const gameFor = async () => {
    const result = await db
      .from('games')
      .select('game_id,config')
      .eq('game_code', QUEST_CODE)
      .eq('engine_code', QUEST_CODE)
      .eq('is_active', true)
      .single();
    fail(result.error, 'Bé chinh phục bàn phím chưa được mở.');
    return result.data;
  };
  return {
    async questProgress(profile) {
      const game = await gameFor();
      return { progress: await questRows(db, profile.user_id, game.game_id) };
    },
    async questFinish(profile, input) {
      if (typeof input.playId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.playId))
        throw new ApiError(400, 'Mã lượt chưa hợp lệ.');
      const game = await gameFor();
      const rows = await questRows(db, profile.user_id, game.game_id);
      const existing = rows.find((row) => row.last_play_id === input.playId);
      if (existing) return { progress: existing };
      const result = await db
        .from('active_plays')
        .select('*')
        .eq('play_id', input.playId)
        .eq('user_id', profile.user_id)
        .eq('game_id', game.game_id)
        .single();
      fail(result.error, 'Không tìm thấy bài luyện của bạn.');
      const play = result.data;
      if (play.result !== 'in_progress')
        throw new ApiError(409, 'Lượt này đã kết thúc. Bạn mở lại bài nhé.');
      const { lesson, grade } = validateQuestFinish(play, input);
      if (
        !Number.isInteger(input.seconds) ||
        input.seconds < play.active_seconds ||
        input.seconds > 86400 ||
        input.seconds > Math.max(0, (Date.now() - Date.parse(play.started_at)) / 1000) + 3
      )
        throw new ApiError(400, 'Thời gian luyện chưa hợp lệ.');
      const saved = await db.rpc('tipy_finish_quest_lesson', {
        p_user: profile.user_id,
        p_play: play.play_id,
        p_lesson: lesson.id,
        p_grade: grade,
        p_values: {
          score: Math.round(grade.accuracy * 10),
          active_seconds: input.seconds,
          result: 'completed',
          ended_at: new Date().toISOString(),
          stage_number: lesson.stage,
          metrics: {
            ...play.metrics,
            correct: grade.correct,
            wrong: grade.wrong,
            accuracy: grade.accuracy,
            lesson_id: lesson.id,
            weak_keys: grade.weakKeys,
            weak_rules: grade.weakRules,
          },
        },
      });
      fail(saved.error, 'Chưa lưu được bài luyện. Bạn bấm Thử lưu lại nhé.');
      if (saved.data?.superseded)
        throw new ApiError(409, 'Bài đang mở ở nơi khác. Bạn mở lại bài nhé.');
      return { progress: saved.data };
    },
    async questReset(profile, input) {
      if (input.confirm !== true) throw new ApiError(400, 'Bạn cần xác nhận đặt lại tiến độ.');
      const game = await gameFor();
      const result = await db.rpc('tipy_reset_quest_progress', {
        p_user: profile.user_id,
        p_game: game.game_id,
      });
      fail(result.error);
      return { progress: [] };
    },
  };
}
