/** Validate monotonic scores/time before the transactional persistence RPC. */
import { ApiError } from '../errors.js';
export function validateLevels(levels) {
  if (!levels || !['easy', 'normal', 'hard'].every((key) => levels[key]))
    throw new ApiError(400, 'Chữ rơi cần ba độ khó: easy, normal, hard.');
  for (const level of Object.values(levels)) {
    if (
      !['fall', 'minFall', 'spawn', 'minSpawn', 'max'].every(
        (key) => Number.isFinite(level[key]) && level[key] > 0,
      ) ||
      level.minFall > level.fall ||
      level.minSpawn > level.spawn ||
      level.minFall < 1 ||
      level.minSpawn < 0.2 ||
      !Number.isInteger(level.max) ||
      level.max > 12
    )
      throw new ApiError(400, 'Tốc độ hoặc số chữ vượt giới hạn cho phép.');
  }
}
export function validateProgress(play, input, now = Date.now()) {
  const seconds = input.seconds,
    score = input.score,
    result = input.result ?? 'in_progress';
  if (
    !Number.isInteger(seconds) ||
    seconds < play.active_seconds ||
    seconds > 86400 ||
    !Number.isInteger(score) ||
    score < play.score ||
    score > 1000000 ||
    !['in_progress', 'completed', 'game_over', 'quit'].includes(result)
  )
    throw new ApiError(400, 'Kết quả lượt chơi chưa hợp lệ.');
  if (seconds > Math.max(0, (now - Date.parse(play.started_at)) / 1000) + 3)
    throw new ApiError(400, 'Thời gian chơi chưa hợp lệ.');
  const old = play.metrics || {},
    metrics = input.metrics || {};
  if (typeof metrics !== 'object' || Array.isArray(metrics))
    throw new ApiError(400, 'Chỉ số lượt chơi chưa hợp lệ.');
  if (play.games.engine_code === 'falling_letters') {
    const { correct, wrong, missed } = metrics;
    if (
      ![correct, wrong, missed].every((n) => Number.isInteger(n) && n >= 0) ||
      correct < (old.correct || 0) ||
      wrong < (old.wrong || 0) ||
      missed < (old.missed || 0) ||
      missed > 3 ||
      wrong > 6 ||
      score !== correct * 10 ||
      correct > seconds * 20 + 20 ||
      wrong > seconds * 30 + 30 ||
      (result === 'game_over' && missed !== 3 && wrong !== 6) ||
      (result === 'in_progress' && (missed === 3 || wrong === 6)) ||
      result === 'completed'
    )
      throw new ApiError(400, 'Số chữ hoặc điểm chưa hợp lệ.');
  }
  const stage = input.stageNumber ?? play.stage_number ?? null;
  if (
    stage !== null &&
    (!Number.isInteger(stage) || stage < 1 || stage > 100000 || stage < (play.stage_number || 0))
  )
    throw new ApiError(400, 'Số màn chưa hợp lệ.');
  return {
    score,
    active_seconds: seconds,
    stage_number: stage,
    result,
    ended_at: result === 'in_progress' ? null : new Date(now).toISOString(),
    metrics:
      play.games.engine_code === 'falling_letters'
        ? {
            ...old,
            correct: metrics.correct ?? 0,
            wrong: metrics.wrong ?? 0,
            missed: metrics.missed ?? 0,
          }
        : { ...old, details: metrics },
  };
}
