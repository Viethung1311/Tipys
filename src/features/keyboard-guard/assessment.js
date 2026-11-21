import { defaultGuardSettings, guardLevel } from './settings.js';
import { createGuard, guardTick, guardInput, guardResult } from './engine.js';

export const GUARD_STEP = 1 / 60;
export function guardAssessmentDefaults(settings = defaultGuardSettings()) {
  const maximum = settings.stages[1].waves.reduce((n, w) => n + w.totalTargets * 10, 0);
  return {
    ids: [],
    order: 'random',
    repeat: true,
    passScore: Math.min(50, maximum),
    goodScore: Math.min(100, maximum),
    waves: settings.stages[1].waves.map((w) => ({ ...w })),
  };
}
export const assignedWord = (item) => (item.target === 'Space' ? ' ' : item.target);
export function guardAssessmentError(value, items) {
  if (
    !value ||
    !['random', 'sequential'].includes(value.order) ||
    typeof value.repeat !== 'boolean'
  )
    return 'Chọn thứ tự và quy tắc lặp nội dung.';
  if (!Array.isArray(value.waves) || value.waves.length < 1 || value.waves.length > 3)
    return 'Bài cần từ 1 đến 3 đợt.';
  const within = (n, lo, hi, integer = true) =>
    Number.isFinite(n) && (!integer || Number.isInteger(n)) && n >= lo && n <= hi;
  if (
    value.waves.some(
      (w) =>
        !within(w.totalTargets, 1, 100) ||
        !within(w.speed, 50, 300) ||
        !within(w.maxActive, 1, Math.min(6, w.totalTargets)) ||
        !within(w.spawnSeconds, 0.5, 10, false) ||
        !within(w.fps, 6, 24),
    )
  )
    return 'Kiểm tra số mục tiêu, tốc độ và khoảng sinh của từng đợt.';
  const total = value.waves.reduce((n, w) => n + w.totalTargets, 0);
  if (total > 100) return 'Mỗi bài tối đa 100 thiên thạch.';
  if (
    !within(value.passScore, 0, total * 10) ||
    !within(value.goodScore, value.passScore, total * 10)
  )
    return 'Điểm hoàn thành tốt phải từ điểm đạt đến điểm tối đa của bài.';
  if (!items.length) return 'Chọn ít nhất một nội dung cho Vệ binh bàn phím.';
  if (
    !value.repeat &&
    new Set(items.map((i) => assignedWord(i).normalize('NFC').toLowerCase())).size < total
  )
    return `Không lặp: cần ít nhất ${total} nội dung khác nhau (không tính từ trùng).`;
  return '';
}
export function guardAssessmentSection(value, items, settings = defaultGuardSettings()) {
  const error = guardAssessmentError(value, items);
  if (error) throw new Error(error);
  const config = guardLevel(settings, 1);
  config.waves = value.waves.length;
  config.waveSettings = value.waves.map((w) => ({ ...w, speedMultiplier: w.speed / 100 }));
  config.totalTargets = value.waves.reduce((n, w) => n + w.totalTargets, 0);
  config.maxActive = Math.max(...value.waves.map((w) => w.maxActive));
  return {
    id: 'guard',
    type: 'guard',
    title: 'Vệ binh bàn phím',
    items,
    config,
    order: value.order,
    repeat: value.repeat,
    passScore: value.passScore,
    goodScore: value.goodScore,
  };
}
function seeded(seed) {
  let n = 2166136261;
  for (const ch of seed) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) | 0;
    return (n >>> 0) / 4294967296;
  };
}
export function createGuardAssessment(section, attemptId) {
  const random = seeded(attemptId);
  const unique = [
    ...new Map(
      section.items.map((i) => [assignedWord(i).normalize('NFC').toLowerCase(), i]),
    ).values(),
  ];
  const queue = [];
  while (queue.length < section.config.totalTargets) {
    const cycle = [...unique];
    if (section.order === 'random')
      for (let i = cycle.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [cycle[i], cycle[j]] = [cycle[j], cycle[i]];
      }
    queue.push(...cycle);
  }
  const words = queue.slice(0, section.config.totalTargets).map((i) => ({
    id: i.id,
    word: assignedWord(i),
    label: i.target === 'Space' ? 'Phím cách' : i.target,
    topicTitle: i.lessonTitle,
  }));
  return {
    state: createGuard({ ...section.config, contentQueue: true }, random, words),
    ticks: 0,
    inputs: [],
  };
}
export function guardAssessmentInput(run, value, options = {}) {
  if (run.state.status !== 'playing' || options.repeat || run.inputs.length >= 12000) return;
  const next = String(value).normalize('NFC').slice(0, 80),
    before = run.state.input;
  let prefix = 0;
  while (prefix < before.length && prefix < next.length && before[prefix] === next[prefix])
    prefix++;
  if (before === next && run.state.composing === Boolean(options.composing)) return;
  run.inputs.push([run.ticks, prefix, next.slice(prefix), options.composing ? 1 : 0]);
  guardInput(run.state, next, options);
}
export function guardAssessmentTick(run) {
  guardTick(run.state, GUARD_STEP);
  run.ticks++;
}
export function guardEvidence(run) {
  return {
    ticks: run.ticks,
    inputs: run.inputs.map((e) => [...e]),
    seconds: Math.floor(run.state.time),
    done: ['won', 'lost'].includes(run.state.status),
  };
}
export function replayGuardAssessment(section, attemptId, evidence = { ticks: 0, inputs: [] }) {
  const invalid = () => {
    throw new Error('Bằng chứng lượt chơi chưa hợp lệ.');
  };
  if (
    !Number.isInteger(evidence.ticks) ||
    evidence.ticks < 0 ||
    evidence.ticks > 864000 ||
    !Array.isArray(evidence.inputs) ||
    evidence.inputs.length > 12000
  )
    invalid();
  const run = createGuardAssessment(section, attemptId);
  for (const event of evidence.inputs) {
    if (!Array.isArray(event) || event.length !== 4) invalid();
    const [tick, prefix, suffix, composing] = event;
    if (
      !Number.isInteger(tick) ||
      tick < run.ticks ||
      tick > evidence.ticks ||
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > 80 ||
      typeof suffix !== 'string' ||
      suffix.length > 80 ||
      ![0, 1].includes(composing)
    )
      invalid();
    while (run.ticks < tick) {
      if (['won', 'lost'].includes(run.state.status)) invalid();
      guardAssessmentTick(run);
    }
    if (prefix > run.state.input.length || run.state.status !== 'playing') invalid();
    const next = run.state.input.slice(0, prefix) + suffix;
    if (next.length > 80 || next !== next.normalize('NFC')) invalid();
    guardInput(run.state, next, { composing: Boolean(composing) });
    run.inputs.push([...event]);
  }
  while (run.ticks < evidence.ticks) {
    if (['won', 'lost'].includes(run.state.status)) invalid();
    guardAssessmentTick(run);
  }
  return run;
}
export function guardAssessmentResult(section, run) {
  const result = guardResult(run.state),
    done = ['won', 'lost'].includes(run.state.status);
  return {
    id: section.id,
    title: section.title,
    type: 'guard',
    seconds: Math.floor(run.state.time),
    score: result.score,
    scoreMax: section.config.totalTargets * section.config.points,
    destroyed: result.destroyed,
    total: section.config.totalTargets,
    correct: run.state.hits,
    wrong: run.state.presses - run.state.hits,
    accuracy: result.accuracy,
    completed: done && result.score >= section.passScore,
    targetScore: section.goodScore,
    outcome:
      done && result.score >= section.goodScore
        ? 'good'
        : done && result.score >= section.passScore
          ? 'completed'
          : 'practice',
  };
}
