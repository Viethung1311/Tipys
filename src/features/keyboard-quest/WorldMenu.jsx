import { BookOpen, Check, Lock } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { isUnlocked } from './curriculum.js';
import { ADVENTURE_WORLDS, worldProgress } from './adventure.js';

export default function WorldMenu({
  progress,
  worldId,
  lessonId,
  busy,
  onClose,
  onWorld,
  onLesson,
}) {
  return (
    <Modal
      title="Chọn màn"
      description="Mở một màn để xem các bài bên trong."
      onClose={onClose}
      className="adventure-menu-dialog"
    >
      {busy && <p role="status">Đang chuyển bài…</p>}
      <div className="adventure-menu-worlds">
        {ADVENTURE_WORLDS.map((world) => {
          const status = worldProgress(world.id, progress);
          return (
            <details key={world.id} open={world.id === worldId || undefined}>
              <summary aria-current={world.id === worldId ? 'step' : undefined}>
                <span>
                  Màn {world.id} · {world.title}
                </span>
                <small>
                  {status.label} · {status.completed}/{status.total} bài
                </small>
              </summary>
              <TipyButton
                emphasis="secondary"
                icon={BookOpen}
                disabled={busy || status.state === 'locked'}
                onClick={() => onWorld(world.id)}
              >
                Xem các bài
              </TipyButton>
              <ul>
                {status.lessons.map((lesson) => {
                  const unlocked = isUnlocked(lesson, progress),
                    completed = progress.some(
                      (row) => row.lesson_id === lesson.id && row.completed,
                    );
                  const Icon = completed ? Check : unlocked ? BookOpen : Lock;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        className="adventure-menu-lesson"
                        disabled={busy || !unlocked}
                        aria-current={lesson.id === lessonId ? 'step' : undefined}
                        onClick={() => onLesson(lesson.id)}
                      >
                        <Icon size={22} aria-hidden="true" />
                        <span>
                          Bài {lesson.stage} · {lesson.title}
                          <small>
                            {completed ? 'Đã hoàn thành' : unlocked ? 'Đang mở' : 'Chưa mở'}
                            {lesson.id === lessonId ? ' · Đang học' : ''}
                          </small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </Modal>
  );
}
