import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, ChartNoAxesCombined, BookOpen } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import { api } from '../../game/backend.js';
import {
  LESSONS,
  LIBRARY_LESSONS,
  ALL_LESSONS,
  QUEST_CODE,
  findLesson,
  isUnlocked,
} from './curriculum.js';
import { updatedProgress } from './engine.js';
import LessonPlayer from './LessonPlayer.jsx';
import PlaySurface, { enterPlayFullscreen } from '../../components/PlaySurface.jsx';
import './quest.css';
import LearningProfile from './LearningProfile.jsx';
import WorldMap from './WorldMap.jsx';
import { learningSummary, practiceLesson } from './progress.js';
import AdventureHeader from './AdventureHeader.jsx';
import AdventureScene from './AdventureScene.jsx';
import { adventureWorld } from './adventure.js';
import './adventure.css';

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
    [worldId, setWorldId] = useState(null),
    [avatar, setAvatar] = useState(null);
  const [navigating, setNavigating] = useState(false),
    [navigationLocked, setNavigationLocked] = useState(false);
  const navigationRef = useRef(null);
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
  }, [user?.user_id, available, revision]);
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
    [user?.user_id],
  );
  const open = (id) => {
    const lesson = findLesson(id);
    if (lesson && available && !loading && !error && isUnlocked(lesson, progress)) {
      if (lesson.world) enterPlayFullscreen();
      if (lesson.world) setWorldId(lesson.world);
      setRun({
        lesson: practiceLesson(lesson, progress),
        key: crypto.randomUUID(),
        previous: progress.find((row) => row.lesson_id === lesson.id),
      });
    } else setRun(null);
  };
  const back = (id) => {
    if (typeof id === 'string') open(id);
    else setRun(null);
  };
  const navigate = async (destination) => {
    if (navigating || navigationLocked) return;
    setNavigating(true);
    try {
      if (run && navigationRef.current) await navigationRef.current(destination);
      else destination();
    } finally {
      setNavigating(false);
    }
  };
  const map = () => {
    setRun(null);
    setWorldId(null);
    setView('map');
  };
  const header = (
    <AdventureHeader
      worldId={run?.lesson.world || worldId}
      lesson={run?.lesson}
      completed={learningSummary(progress).completed}
      busy={navigating || navigationLocked || loading || !available}
      onBack={() => navigate(onBack)}
      onMap={() => navigate(map)}
      onList={() =>
        navigate(() => {
          setRun(null);
          setView('map');
        })
      }
    />
  );
  if (run)
    return (
      <PlaySurface active={Boolean(run.lesson.world)}>
        <main className="quest-page adventure-page">
          {run.lesson.world ? (
            <nav
              className="quest-play-navigation adventure-breadcrumbs"
              aria-label="Đường đi hành trình"
            >
              <TipyButton
                emphasis="secondary"
                icon={Map}
                disabled={navigating || navigationLocked || loading || !available}
                onClick={() => navigate(map)}
              >
                Bản đồ
              </TipyButton>
            </nav>
          ) : (
            header
          )}
          <AdventureScene
            world={adventureWorld(run.lesson.world || worldId || 1)}
            playing={Boolean(run.lesson.world)}
          >
            <LessonPlayer
              key={run.key}
              lesson={run.lesson}
              immersive={Boolean(run.lesson.world)}
              world={run.lesson.world ? adventureWorld(run.lesson.world) : null}
              user={user}
              sound={sound}
              blocked={blocked || navigating}
              navigationRef={navigationRef}
              onNavigationLockChange={setNavigationLocked}
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
          </AdventureScene>
        </main>
      </PlaySurface>
    );
  return (
    <main className="quest-page adventure-page">
      {header}
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
                onClick={() => {
                  setView(id);
                  if (id === 'map') setWorldId(null);
                }}
              >
                {label}
              </TipyButton>
            ))}
          </nav>
          {view === 'profile' && (
            <LearningProfile progress={progress} avatar={avatarOverride || avatar} user={user} />
          )}
          {view === 'map' && (
            <WorldMap
              worldId={worldId}
              onChooseWorld={setWorldId}
              progress={progress}
              onOpen={open}
              mode={mode}
              onModeChange={setMode}
            />
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
    </main>
  );
}
