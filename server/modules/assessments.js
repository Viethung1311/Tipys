import { ApiError, requireAdmin } from '../errors.js';
import { uuid, text } from './classrooms.js';
import { validateLevels, validateProgress } from './game-validation.js';
import { TEST_CONTENT } from '../../src/features/assessments/content.js';
import { SUPPORTED_KEYS, LEVELS } from '../../src/game/config.js';
import { matchesTarget } from '../../src/features/keyboard-quest/engine.js';
const invalid = () => {
  throw new ApiError(400, 'Nội dung hoặc kết quả bài kiểm tra chưa hợp lệ.');
};
const distinct = (values, max) => {
  if (!Array.isArray(values) || values.length > max || new Set(values).size !== values.length)
    invalid();
  return values;
};
export function assessmentSnapshot(input, levels = LEVELS) {
  if (
    typeof input.title !== 'string' ||
    ['description', 'instructions'].some(
      (key) => input[key] !== undefined && typeof input[key] !== 'string',
    )
  )
    invalid();
  const selection = input.selection || {},
    sections = [];
  const questIds = distinct(selection.questIds || [], TEST_CONTENT.length);
  const classIds = distinct(input.targets?.classIds || [], 100).map(uuid),
    userIds = distinct(input.targets?.userIds || [], 1000).map(uuid);
  if (selection.falling) {
    const { difficulty, keys } = selection.falling;
    if (
      !['easy', 'normal', 'hard'].includes(difficulty) ||
      !distinct(keys, SUPPORTED_KEYS.size).length ||
      keys.some((k) => !SUPPORTED_KEYS.has(k))
    )
      invalid();
    validateLevels(levels);
    sections.push({
      id: 'falling',
      type: 'falling',
      title: 'Chữ rơi',
      settings: { difficulty, keys: [...keys], levels },
    });
  }
  if (questIds.length) {
    const items = questIds.map((id) => TEST_CONTENT.find((item) => item.id === id));
    if (items.some((i) => !i)) invalid();
    sections.push({ id: 'quest', type: 'quest', title: 'Gõ và viết chữ', items });
  }
  return {
    title: text(input.title, 100, 'Tên bài'),
    description: text(input.description, 1000, 'Giới thiệu', false),
    instructions: text(input.instructions, 2000, 'Cách chơi', false),
    targets: { classIds, userIds },
    selection: { questIds, falling: selection.falling || null },
    sections,
  };
}
/** Grade selected snapshots; ignore browser-supplied totals, accuracy and stars. */
export function assessmentResult(definition, payload, attempt, now = Date.now()) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Object.keys(payload).some((id) => !definition.sections.some((s) => s.id === id))
  )
    invalid();
  const output = {},
    results = [];
  let seconds = 0;
  for (const section of definition.sections) {
    const value = payload[section.id],
      old = attempt.payload?.[section.id];
    if (!value) {
      if (old) invalid();
      results.push({
        id: section.id,
        title: section.title,
        type: section.type,
        seconds: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        completed: false,
        ...(section.type === 'quest'
          ? { answered: 0, total: section.items.length }
          : { score: 0, missed: 0 }),
      });
      continue;
    }
    if (
      !Number.isInteger(value.seconds) ||
      value.seconds < 0 ||
      value.seconds > 86400 ||
      value.seconds < (old?.seconds || 0)
    )
      invalid();
    seconds += value.seconds;
    if (section.type === 'quest') {
      if (!Array.isArray(value.answers) || value.answers.length !== section.items.length) invalid();
      let correct = 0,
        wrong = 0;
      const answers = value.answers.map((row, index) => {
        const item = section.items[index],
          prior = old?.answers?.[index];
        if (
          !row ||
          row.itemId !== item.id ||
          typeof row.answer !== 'string' ||
          (row.answer !== '' && !matchesTarget(row.answer, item.target)) ||
          !['errors', 'position', 'telex', 'editing'].every(
            (key) =>
              Number.isInteger(row[key]) &&
              row[key] >= 0 &&
              row[key] <= 10000 &&
              row[key] >= (prior?.[key] || 0),
          ) ||
          row.errors !== row.position + row.telex + row.editing ||
          (item.kind === 'key' && row.errors !== row.position) ||
          (item.kind === 'text' && row.position !== 0) ||
          (!item.telex && row.telex !== 0) ||
          (prior?.answer && !matchesTarget(row.answer, prior.answer))
        )
          invalid();
        if (row.answer) correct++;
        wrong += row.errors;
        return {
          itemId: item.id,
          answer: row.answer ? item.target : '',
          errors: row.errors,
          position: row.position,
          telex: row.telex,
          editing: row.editing,
        };
      });
      output[section.id] = {
        seconds: value.seconds,
        answers,
        done: correct === section.items.length,
      };
      results.push({
        id: section.id,
        title: section.title,
        type: 'quest',
        seconds: value.seconds,
        correct,
        wrong,
        accuracy: correct + wrong ? Math.round((10000 * correct) / (correct + wrong)) / 100 : 0,
        answered: correct,
        total: section.items.length,
        completed: correct === section.items.length,
      });
    } else {
      const state = value.state;
      if (!state || !['countdown', 'playing', 'paused', 'result'].includes(state.status)) invalid();
      const { correct, wrong, missed } = state;
      validateProgress(
        {
          active_seconds: old?.seconds || 0,
          score: (old?.state?.correct || 0) * 10,
          started_at: attempt.started_at,
          games: { engine_code: 'falling_letters' },
          metrics: old?.state || {},
        },
        {
          seconds: value.seconds,
          score: correct * 10,
          result: state.status === 'result' ? 'game_over' : 'in_progress',
          metrics: { correct, wrong, missed },
        },
        now,
      );
      if (
        state.lives !== 3 - missed ||
        !Number.isFinite(state.elapsed) ||
        Math.floor(state.elapsed) !== value.seconds ||
        !Number.isFinite(state.countdown) ||
        state.countdown < 0 ||
        state.countdown > 3 ||
        !Number.isFinite(state.spawnIn) ||
        state.spawnIn < -1 ||
        state.spawnIn > 30 ||
        !Number.isInteger(state.nextId) ||
        state.nextId < 0 ||
        state.nextId > 1000000 ||
        !Array.isArray(state.bag) ||
        state.bag.length > section.settings.keys.length ||
        state.bag.some((k) => !section.settings.keys.includes(k)) ||
        !Array.isArray(state.letters) ||
        state.letters.length > 12 ||
        (old?.done && state.status !== 'result')
      )
        invalid();
      const ids = new Set();
      const letters = state.letters.map((letter) => {
        if (
          !letter ||
          !section.settings.keys.includes(letter.key) ||
          !Number.isInteger(letter.id) ||
          letter.id < 0 ||
          letter.id >= state.nextId ||
          ids.has(letter.id) ||
          !Number.isInteger(letter.column) ||
          letter.column < 0 ||
          letter.column > 5 ||
          !Number.isFinite(letter.y) ||
          letter.y < 0 ||
          letter.y >= 1 ||
          !Number.isFinite(letter.fall) ||
          letter.fall < section.settings.levels[section.settings.difficulty].minFall ||
          letter.fall > 30
        )
          invalid();
        ids.add(letter.id);
        return {
          id: letter.id,
          key: letter.key,
          column: letter.column,
          y: letter.y,
          fall: letter.fall,
        };
      });
      output[section.id] = {
        seconds: value.seconds,
        done: state.status === 'result',
        state: {
          status: state.status,
          previous: state.previous === 'countdown' ? 'countdown' : 'playing',
          elapsed: state.elapsed,
          countdown: state.countdown,
          score: correct * 10,
          correct,
          wrong,
          missed,
          lives: 3 - missed,
          letters,
          bag: state.bag,
          spawnIn: state.spawnIn,
          nextId: state.nextId,
          lastKey: section.settings.keys.includes(state.lastKey) ? state.lastKey : '',
          feedback: '',
          endReason: wrong === 6 ? 'wrong_limit' : undefined,
        },
      };
      results.push({
        id: section.id,
        title: section.title,
        type: 'falling',
        seconds: value.seconds,
        correct,
        wrong,
        missed,
        score: correct * 10,
        accuracy: correct + wrong ? Math.round((10000 * correct) / (correct + wrong)) / 100 : 0,
        completed: state.status === 'result',
      });
    }
  }
  if (
    seconds > 86400 ||
    seconds < attempt.active_seconds ||
    seconds > Math.max(0, (now - Date.parse(attempt.started_at)) / 1000) + 3
  )
    invalid();
  return { payload: output, results, seconds };
}

export function createAssessments(db) {
  const rpc = async (profile, action, input = {}) => {
    const result = await db.rpc('tipy_assessment', {
      p_actor: profile.user_id,
      p_action: action,
      p_input: input,
    });
    if (result.error) {
      const message = result.error.message || '';
      if (/Access denied|Admin required|Student assignment/.test(message))
        throw new ApiError(403, 'Bạn không có quyền mở bài kiểm tra này.');
      if (/Conflict/.test(message))
        throw new ApiError(409, 'Bài đã thay đổi ở nơi khác. Tải lại trước khi tiếp tục.');
      if (/immutable/.test(message))
        throw new ApiError(409, 'Bài đã gửi không thể sửa. Hãy tạo bản mới.');
      if (/already submitted/.test(message))
        throw new ApiError(409, 'Bài đã nộp. Chờ thầy cô cho làm lại nhé.');
      throw new ApiError(
        400,
        /recipients|No students/.test(message)
          ? 'Nơi nhận chưa hợp lệ hoặc chưa có học sinh.'
          : 'Chưa xử lý được bài kiểm tra. Kiểm tra nội dung rồi thử lại.',
      );
    }
    return result.data;
  };
  const scope = (input) => {
    uuid(input.assessmentId);
    return input;
  };
  return {
    async assessments(profile, input) {
      const page = Number(input.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 100000) invalid();
      return rpc(profile, 'list', { page });
    },
    async assessment(profile, input) {
      return rpc(profile, 'detail', scope(input));
    },
    async assessmentSave(profile, input) {
      requireAdmin(profile);
      scope(input);
      uuid(input.requestId);
      if (!Number.isInteger(input.version) || input.version < 0) invalid();
      let levels = LEVELS;
      if (input.selection?.falling) {
        const game = await db
          .from('games')
          .select('config')
          .eq('game_code', 'falling_letters')
          .single();
        if (game.error) throw new ApiError(400, 'Chưa mở được cấu hình Chữ rơi.');
        levels = game.data.config?.levels || LEVELS;
      }
      return rpc(profile, 'save', {
        assessmentId: input.assessmentId,
        requestId: input.requestId,
        version: input.version,
        definition: assessmentSnapshot(input, levels),
      });
    },
    async assessmentPublish(profile, input) {
      requireAdmin(profile);
      scope(input);
      if (!Number.isInteger(input.version) || input.version < 1) invalid();
      return rpc(profile, 'publish', input);
    },
    async assessmentResults(profile, input) {
      requireAdmin(profile);
      scope(input);
      const page = Number(input.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 100000) invalid();
      return rpc(profile, 'results', { ...input, page });
    },
    async assessmentRetake(profile, input) {
      requireAdmin(profile);
      scope(input);
      uuid(input.userId);
      uuid(input.attemptId);
      return rpc(profile, 'retake', input);
    },
    async assessmentStart(profile, input) {
      return rpc(profile, 'start', scope(input));
    },
    async assessmentSubmit(profile, input) {
      return this.assessmentWrite(profile, input, true);
    },
    async assessmentWrite(profile, input, submit = false) {
      scope(input);
      uuid(input.attemptId);
      uuid(input.requestId);
      if (!Number.isInteger(input.revision) || input.revision < 0) invalid();
      const detail = await rpc(profile, 'detail', { assessmentId: input.assessmentId });
      if (!detail.attempt || detail.attempt.attempt_id !== input.attemptId)
        throw new ApiError(403, 'Lượt kiểm tra không thuộc về bạn.');
      const grade = assessmentResult(detail.assessment.definition, input.payload, detail.attempt);
      return rpc(profile, submit ? 'submit' : 'checkpoint', {
        assessmentId: input.assessmentId,
        attemptId: input.attemptId,
        requestId: input.requestId,
        revision: input.revision,
        ...grade,
      });
    },
  };
}
