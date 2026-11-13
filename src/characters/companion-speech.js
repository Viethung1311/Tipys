export const DIALOGUE = {
  notification_assessment: ['Vào làm bài kiểm tra thôi nào, bạn ơi!'],
  notification_gift: ['Bạn đã nhận được sao từ thầy Hùng!'],
  notification_batch: ['Bạn có bài kiểm tra mới và sao từ thầy Hùng!'],
  welcome: [
    'Bạn tới rồi! Chơi cùng mình nhé!',
    'Hôm nay mình khám phá gì nào?',
    'Đôi tay nhỏ đã sẵn sàng chưa?',
  ],
  start: [
    'Đặt tay ngay ngắn, xuất phát!',
    'Mình tin bạn làm được!',
    'Cùng chinh phục thử thách nào!',
  ],
  correct: [
    'Chuẩn luôn!',
    'Đúng phím rồi nè!',
    'Hay quá, tiếp tục nào!',
    'Đôi tay nhanh nhẹn ghê!',
  ],
  wrong: ['Không sao, thử lại nha!', 'Nhìn kỹ phím một chút nhé!', 'Chậm một chút cũng được mà!'],
  missed: [
    'Hít thở nào, mình vẫn ở đây!',
    'Còn cơ hội, cố lên bạn nhé!',
    'Lượt tới mình sẽ làm tốt hơn!',
  ],
  complete: [
    'Tèn ten! Qua màn rồi!',
    'Thêm một thử thách được chinh phục!',
    'Đập tay nào, bạn giỏi lắm!',
  ],
  record: ['Oa! Kỷ lục mới của bạn!', 'Bạn đã vượt qua chính mình!', 'Mình phải ăn mừng thôi!'],
  finish: [
    'Bạn đã cố gắng rất nhiều!',
    'Mình cùng thử thêm lần nữa nhé!',
    'Mỗi lần luyện là thêm tiến bộ!',
  ],
  click: [
    'Ú òa! Bạn tìm mình hả?',
    'Mình là đồng đội của bạn đó!',
    'Đập tay qua màn hình nào!',
    'Nhột quá! Hi hi!',
  ],
  drag: ['Đi dạo một vòng nào!', 'Đặt mình ở góc xinh nhé!', 'Vùuuu! Mình đang bay!'],
  rest: [
    'Thả lỏng đôi tay chút nha!',
    'Nhìn xa một chút cùng mình nhé!',
    'Nghỉ một lát rồi khám phá tiếp!',
  ],
};
const PRIORITY = {
  notification_assessment: 8,
  notification_gift: 8,
  notification_batch: 8,
  correct: 0,
  wrong: 0,
  welcome: 1,
  rest: 1,
  click: 2,
  drag: 2,
  start: 3,
  missed: 4,
  finish: 5,
  complete: 6,
  record: 7,
};
export const SPEECH_EVENT = 'tipy-companion-speech';
export function companionSay(group) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(SPEECH_EVENT, { detail: group }));
}
/** Drop stale events instead of queueing; important events may replace a minor reaction. */
export function createSpeechGate(random = Math.random) {
  let lastAt = -Infinity,
    activeUntil = 0,
    activePriority = -1,
    lastText = '';
  return (group, now) => {
    if (!DIALOGUE[group]) return null;
    const priority = PRIORITY[group];
    const gap = priority >= 2 ? 3000 : 9000;
    if (now - lastAt < gap && priority <= activePriority) return null;
    const alternatives = DIALOGUE[group].filter((text) => text !== lastText);
    const choices = alternatives.length ? alternatives : DIALOGUE[group];
    const text = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    lastAt = now;
    activeUntil = now + 2500;
    activePriority = priority;
    lastText = text;
    return { text, until: activeUntil };
  };
}

export function bubblePosition(anchor, box, viewport, obstacles) {
  const gap = 10,
    pad = 12;
  const candidates = [
    { left: anchor.left - box.width - gap, top: anchor.top + (anchor.height - box.height) / 2 },
    { left: anchor.right + gap, top: anchor.top + (anchor.height - box.height) / 2 },
    { left: anchor.left + (anchor.width - box.width) / 2, top: anchor.top - box.height - gap },
    { left: anchor.left + (anchor.width - box.width) / 2, top: anchor.bottom + gap },
  ];
  for (const candidate of candidates) {
    const left = Math.max(
      viewport.left + pad,
      Math.min(viewport.right - box.width - pad, candidate.left),
    );
    const top = Math.max(
      viewport.top + pad,
      Math.min(viewport.bottom - box.height - pad, candidate.top),
    );
    const overlaps = (r) =>
      left < r.right && left + box.width > r.left && top < r.bottom && top + box.height > r.top;
    if (!overlaps(anchor) && !obstacles.some(overlaps)) return { left, top };
  }
  return null;
}
