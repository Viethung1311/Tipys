import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock, Play, RotateCcw } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import { api } from '../../game/backend.js';
import { LESSONS, WORLDS, QUEST_CODE, findLesson, isUnlocked } from './curriculum.js';
import { updatedProgress } from './engine.js';
import LessonPlayer from './LessonPlayer.jsx';
import './quest.css';

const guestKey = 'tipy-quest-guest-v1';
export default function KeyboardQuest({ user, catalog, sound, blocked, onPlayingChange, onBack }) {
  const [progress, setProgress] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [run, setRun] = useState(null),
    [reset, setReset] = useState(false),
    [resetting, setResetting] = useState(false),
    [revision, setRevision] = useState(0);
  const available =
    catalog === null ||
    catalog.some(
      (game) => game.game_code === QUEST_CODE && game.engine_code === QUEST_CODE && game.is_active,
    );
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const read = async () => {
      try {
        let rows;
        if (user) rows = available ? (await api('quest_progress')).progress : [];
        else {
          try {
            rows = JSON.parse(localStorage.getItem(guestKey) || '[]');
          } catch {
            rows = [];
          }
          rows = Array.isArray(rows)
            ? rows.filter(
                (row) =>
                  row &&
                  findLesson(row.lesson_id) &&
                  typeof row.completed === 'boolean' &&
                  Number.isInteger(row.best_stars) &&
                  row.best_stars >= 0 &&
                  row.best_stars <= 3,
              )
            : [];
        }
        if (!cancelled) setProgress(rows);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    read();
    return () => {
      cancelled = true;
    };
  }, [user, available, revision]);
  const saved = useCallback(
    (lesson, grade, row) => {
      setProgress((old) => {
        const next = user
          ? [...old.filter((item) => item.lesson_id !== row.lesson_id), row]
          : updatedProgress(old, lesson, grade);
        if (!user) {
          try {
            localStorage.setItem(guestKey, JSON.stringify(next));
          } catch {
            /* Progress still works for this open demo. */
          }
        }
        return next;
      });
    },
    [user],
  );
  const open = (id) => {
    const lesson = findLesson(id);
    if (lesson && available && !loading && !error && isUnlocked(lesson, progress))
      setRun({ lesson, key: crypto.randomUUID() });
    else setRun(null);
  };
  const back = (id) => {
    if (typeof id === 'string') open(id);
    else setRun(null);
  };
  const resetProgress = async () => {
    setResetting(true);
    setError('');
    try {
      if (user) await api('quest_reset', { confirm: true });
      else localStorage.removeItem(guestKey);
      setProgress([]);
      setReset(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setResetting(false);
    }
  };
  if (run)
    return (
      <div className="quest-page">
        <LessonPlayer
          key={run.key}
          lesson={run.lesson}
          user={user}
          sound={sound}
          blocked={blocked}
          onPlayingChange={onPlayingChange}
          onBack={back}
          onSaved={saved}
          nextLesson={LESSONS.find((lesson) => lesson.previous === run.lesson.id)}
        />
      </div>
    );
  return (
    <div className="quest-page">
      <section className="panel quest-hero">
        <span className="quest-mascot" aria-hidden="true">
          🗺️
        </span>
        <h1>Bé chinh phục bàn phím</h1>
        <p>Mỗi ngày một bước nhỏ. Mình cùng khám phá nhé!</p>
        <p>
          {user
            ? 'Tiến độ được lưu vào tài khoản TIPY.'
            : 'Bạn đang chơi thử. Đăng nhập để lưu tiến độ vào tài khoản.'}
        </p>
        <p>
          {progress.filter((row) => row.completed).length}/{LESSONS.length} bài hoàn thành ·{' '}
          {progress.reduce((sum, row) => sum + row.best_stars, 0)} sao
        </p>
        <TipyButton emphasis="secondary" icon={ArrowLeft} onClick={onBack}>
          Gõ chữ
        </TipyButton>
      </section>
      {loading ? (
        <Loading label="Đang mở hành trình…" />
      ) : error ? (
        <section className="panel quest-state">
          <p role="alert">{error}</p>
          <TipyButton onClick={() => setRevision((old) => old + 1)}>Thử lại</TipyButton>
        </section>
      ) : !available ? (
        <section className="panel quest-state">
          <h2>Trò chơi chưa được mở</h2>
          <p>Thầy cô sẽ mở hành trình này khi đã sẵn sàng nhé.</p>
        </section>
      ) : (
        <>
          <div className="quest-worlds">
            {WORLDS.map((world) => (
              <section className="panel quest-world" key={world.id}>
                <h2>
                  <span aria-hidden="true">{world.icon}</span> {world.title}
                </h2>
                {LESSONS.filter((lesson) => lesson.world === world.id).length ? (
                  <div className="quest-lessons">
                    {LESSONS.filter((lesson) => lesson.world === world.id).map((lesson) => {
                      const unlocked = isUnlocked(lesson, progress),
                        row = progress.find((item) => item.lesson_id === lesson.id);
                      return (
                        <article className="quest-lesson" key={lesson.id}>
                          <div>
                            <h3>{lesson.title}</h3>
                            <p>
                              {lesson.demo ? 'Bài trải nghiệm · mở sẵn' : `Bước ${lesson.stage}`} ·{' '}
                              {row?.completed
                                ? `${row.best_stars} sao`
                                : unlocked
                                  ? 'Sẵn sàng'
                                  : 'Hoàn thành bài trước'}
                            </p>
                          </div>
                          <TipyButton
                            icon={unlocked ? Play : Lock}
                            disabled={!unlocked}
                            emphasis={row?.completed ? 'secondary' : undefined}
                            onClick={() => open(lesson.id)}
                          >
                            {unlocked ? (row?.completed ? 'Luyện lại' : 'Vào học') : 'Chưa mở'}
                          </TipyButton>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p>Sắp ra mắt. Bạn hãy thử các bài đang mở nhé!</p>
                )}
              </section>
            ))}
          </div>
          <TipyButton
            emphasis="secondary"
            icon={RotateCcw}
            disabled={!progress.length}
            onClick={() => setReset(true)}
          >
            Đặt lại
          </TipyButton>
        </>
      )}
      {reset && (
        <Modal
          title="Đặt lại hành trình?"
          description="Chỉ xóa tiến độ bài học này. Tổng thời gian luyện và kết quả Chữ rơi được giữ nguyên."
        >
          <div className="quest-actions">
            <TipyButton loading={resetting} onClick={resetProgress}>
              Đặt lại
            </TipyButton>
            <TipyButton emphasis="secondary" disabled={resetting} onClick={() => setReset(false)}>
              Quay lại
            </TipyButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
