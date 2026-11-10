import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Lock,
  Play,
  RotateCcw,
  Map,
  ChartNoAxesCombined,
  BookOpen,
  CalendarDays,
} from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import { api } from '../../game/backend.js';
import {
  LESSONS,
  LIBRARY_LESSONS,
  ALL_LESSONS,
  WORLDS,
  QUEST_CODE,
  findLesson,
  isUnlocked,
} from './curriculum.js';
import { updatedProgress } from './engine.js';
import LessonPlayer from './LessonPlayer.jsx';
import './quest.css';
import LearningProfile from './LearningProfile.jsx';
import TelexGuide from './TelexGuide.jsx';
import { learningSummary, recommendedLessons, practiceLesson } from './progress.js';

const guestKey = 'tipy-quest-guest-v1';
export default function KeyboardQuest({
  user,
  catalog,
  sound,
  blocked,
  onPlayingChange,
  onBack,
  avatarOverride,
}) {
  const [progress, setProgress] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [run, setRun] = useState(null),
    [revision, setRevision] = useState(0),
    [view, setView] = useState('map'),
    [mode, setMode] = useState('learn'),
    [avatar, setAvatar] = useState(null);
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
        if (user) {
          if (available) {
            const [data, avatarData] = await Promise.all([
              api('quest_progress'),
              api('avatar').catch(() => null),
            ]);
            rows = data.progress;
            if (!cancelled) setAvatar(avatarData?.avatar || null);
          } else rows = [];
        } else {
          try {
            rows = JSON.parse(localStorage.getItem(guestKey) || '[]');
          } catch {
            rows = [];
          }
          rows = Array.isArray(rows)
            ? ALL_LESSONS.map((lesson) => rows.find((row) => row?.lesson_id === lesson.id)).filter(
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
    (lesson, grade, row, seconds) => {
      setProgress((old) => {
        const next = user
          ? [...old.filter((item) => item.lesson_id !== row.lesson_id), row]
          : updatedProgress(old, lesson, grade, seconds);
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
      setRun({
        lesson: practiceLesson(lesson, progress),
        key: crypto.randomUUID(),
        previous: progress.find((row) => row.lesson_id === lesson.id),
      });
    else setRun(null);
  };
  const back = (id) => {
    if (typeof id === 'string') open(id);
    else setRun(null);
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
          mode={mode}
          previous={run.previous}
          nextLesson={LESSONS.find(
            (lesson) =>
              lesson.stage === run.lesson.stage + 1 &&
              isUnlocked(lesson, [...progress, { lesson_id: run.lesson.id, completed: true }]),
          )}
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
          {learningSummary(progress).completed}/{LESSONS.length} bài hoàn thành ·{' '}
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
          <nav className="quest-actions" aria-label="Góc học bàn phím">
            {[
              ['map', 'Bản đồ', Map],
              ['profile', 'Tiến bộ', ChartNoAxesCombined],
              ['library', 'Từ vựng', BookOpen],
            ].map(([id, label, Icon]) => (
              <TipyButton
                key={id}
                icon={Icon}
                emphasis={view === id ? undefined : 'secondary'}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => setView(id)}
              >
                {label}
              </TipyButton>
            ))}
          </nav>
          {view === 'map' && (
            <section className="panel quest-recommend">
              <h2>Hôm nay mình luyện gì?</h2>
              <label>
                Kiểu chơi
                <select value={mode} onChange={(event) => setMode(event.target.value)}>
                  <option value="learn">Cùng học</option>
                  <option value="race">Đua xe một mình</option>
                </select>
              </label>
              <div className="quest-actions">
                {recommendedLessons(progress).next && (
                  <TipyButton onClick={() => open(recommendedLessons(progress).next.id)}>
                    Học tiếp
                  </TipyButton>
                )}
                {recommendedLessons(progress).review && (
                  <TipyButton
                    emphasis="secondary"
                    icon={RotateCcw}
                    onClick={() => open(recommendedLessons(progress).review.id)}
                  >
                    Ôn tập
                  </TipyButton>
                )}
                <TipyButton
                  emphasis="secondary"
                  icon={CalendarDays}
                  onClick={() => {
                    const frontier = recommendedLessons(progress).next?.stage || 30;
                    const choices = LESSONS.filter(
                      (lesson) => lesson.stage <= frontier && isUnlocked(lesson, progress),
                    );
                    const day = new Date();
                    open(
                      choices[(day.getFullYear() + day.getMonth() + day.getDate()) % choices.length]
                        .id,
                    );
                  }}
                >
                  Thử hôm nay
                </TipyButton>
              </div>
              <p>Bài ôn ưu tiên nội dung bạn từng nhầm. Không cần chơi liên tục mỗi ngày.</p>
            </section>
          )}
          {view === 'profile' && (
            <LearningProfile progress={progress} avatar={avatarOverride || avatar} user={user} />
          )}
          {view === 'map' && (
            <div className="quest-worlds">
              {WORLDS.map((world) => (
                <section className="panel quest-world" key={world.id}>
                  <h2>
                    <span aria-hidden="true">{world.icon}</span> {world.title}
                  </h2>
                  {world.id === 4 && <TelexGuide />}
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
                                {lesson.demo ? 'Bài trải nghiệm · mở sẵn' : `Bước ${lesson.stage}`}{' '}
                                ·{' '}
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
          )}
          {view === 'library' && (
            <section className="panel">
              <h2>Thư viện từ vựng</h2>
              <p>Hoàn thành đủ 30 màn để mở 9 chủ đề. Mỗi chủ đề có 10 từ.</p>
              <div className="quest-lessons">
                {LIBRARY_LESSONS.map((lesson) => (
                  <article className="quest-lesson" key={lesson.id}>
                    <h3>{lesson.title}</h3>
                    <TipyButton
                      disabled={!isUnlocked(lesson, progress)}
                      onClick={() => open(lesson.id)}
                    >
                      {isUnlocked(lesson, progress) ? 'Vào học' : 'Chưa mở'}
                    </TipyButton>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
