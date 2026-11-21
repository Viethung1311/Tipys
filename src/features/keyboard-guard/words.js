import { VOCABULARY } from '../keyboard-quest/content.js';
import { normalizeText } from '../keyboard-quest/engine.js';

export const guardText = (value) => normalizeText(value).toLocaleLowerCase('vi');
export const guardFold = (value) =>
  guardText(value).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
const STAGE_TOPICS = {
  1: ['family', 'animals', 'school'],
  2: ['nature', 'science', 'technology'],
  3: ['places', 'history', 'heroes'],
};
export function guardWords(stage = 1) {
  const maxLength = { 1: 8, 2: 11, 3: 18 }[stage] || 8;
  return VOCABULARY.filter((topic) => STAGE_TOPICS[stage]?.includes(topic.id)).flatMap((topic) =>
    topic.words
      .filter((word) => [...word].length <= maxLength)
      .map((word) => ({ word, topic: topic.id, topicTitle: topic.title, image: topic.image })),
  );
}
export const GUARD_WORDS = guardWords(1);
