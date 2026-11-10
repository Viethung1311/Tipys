import { api } from '../../game/backend.js';
import { QUEST_CODE } from './curriculum.js';
/** Serialize heartbeats and final save so a late update cannot replace completion. */
export function createLessonSession(lesson, request = api) {
  let playId,
    queue = Promise.resolve(),
    lastSeconds = 0,
    closed = false;
  const ready = request('start', {
    gameCode: QUEST_CODE,
    stageNumber: lesson.stage,
    lessonId: lesson.id,
  }).then((result) => {
    playId = result.data.play_id;
    return playId;
  });
  return {
    ready,
    progress(seconds) {
      if (closed || seconds - lastSeconds < 10) return queue;
      lastSeconds = seconds;
      queue = queue
        .catch(() => {})
        .then(async () => {
          await ready;
          return request('progress', {
            playId,
            seconds,
            score: 0,
            result: 'in_progress',
            metrics: {},
          });
        });
      return queue;
    },
    finish(seconds, answers) {
      closed = true;
      queue = queue
        .catch(() => {})
        .then(async () => {
          await ready;
          return request('quest_finish', { playId, seconds, answers });
        });
      return queue;
    },
    quit(seconds) {
      if (closed) return queue;
      closed = true;
      queue = queue
        .catch(() => {})
        .then(async () => {
          await ready;
          return request('progress', { playId, seconds, score: 0, result: 'quit', metrics: {} });
        });
      return queue;
    },
  };
}
