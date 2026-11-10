import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Keyboard, Volume2, VolumeX } from 'lucide-react';
import Account from './components/Account.jsx';
import AudioSettings from './components/AudioSettings.jsx';
import HomePage from './screens/HomePage.jsx';
import GameLibrary from './screens/GameLibrary.jsx';
const TypingSetup = lazy(() => import('./features/typing/TypingSetup.jsx'));
const TypingGame = lazy(() => import('./features/typing/TypingGame.jsx'));
const ClassroomPage = lazy(() => import('./features/classroom/ClassroomPage.jsx'));
import Loading from './components/Loading.jsx';
import Reveal from './shared/Reveal.jsx';
import useGameAudio from './hooks/useGameAudio.js';
import { LEVELS, load, save, readSettings, recordKey } from './game/config.js';

/** App shell owns navigation and identity. Each feature owns its own data and UI. */
export default function App() {
  const [screen, setScreen] = useState(() =>
    location.hash === '#typing'
      ? 'library'
      : location.hash === '#typing/setup'
        ? 'setup'
        : location.hash === '#classroom'
          ? 'classroom'
          : 'home',
  );
  const [settings, setSettings] = useState(readSettings),
    [runSettings, setRunSettings] = useState(settings);
  const [user, setUser] = useState(null),
    [catalog, setCatalog] = useState(null),
    [classes, setClasses] = useState([]);
  const classroomCache = useRef(new Map());
  useEffect(() => classroomCache.current.clear(), [user?.user_id]);
  const [myAvatar, setMyAvatar] = useState(null);
  useEffect(() => setMyAvatar(null), [user?.user_id]);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [gamePlaying, setGamePlaying] = useState(false);
  const canClassroom = Boolean(
    user && (user.role === 'admin' || classes.some((c) => !c.archived_at)),
  );
  const navigate = (next) => {
    setScreen(next);
    history.replaceState(
      null,
      '',
      next === 'home'
        ? '#home'
        : next === 'library'
          ? '#typing'
          : next === 'setup'
            ? '#typing/setup'
            : `#${next}`,
    );
  };
  const { preferences, setPreferences, play } = useGameAudio(
    screen === 'game' && gamePlaying && !audioOpen && !accountOpen,
  );
  useEffect(() => save('tipy-settings', settings), [settings]);
  const start = () => {
    const game = catalog?.find((g) => g.game_code === 'falling_letters');
    setRunSettings({ ...settings, levels: game?.config?.levels || LEVELS });
    setScreen('game');
  };
  const finish = (state) => {
    const key = recordKey(state.settings);
    if (state.score > load(key, 0)) {
      save(key, state.score);
      return true;
    }
    return false;
  };
  return (
    <>
      <header className="site-header">
        <button className="brand" onClick={() => navigate('home')} aria-label="TIPY STEM trang chủ">
          <span className="brand-icon">
            <Keyboard size={23} />
          </span>
          <span>
            TIPY<span className="brand-stem"> STEM</span>
            <small>HỌC VUI MỖI NGÀY</small>
          </span>
        </button>
        <div className="header-right">
          <span className="header-message">Học thật vui. Lớn thật hay.</span>
          <button
            className="sound-button audio-trigger"
            aria-label="Cài đặt âm thanh"
            onClick={() => setAudioOpen(true)}
          >
            {preferences.effectsEnabled || preferences.musicEnabled ? (
              <Volume2 size={18} />
            ) : (
              <VolumeX size={18} />
            )}
            <span className="sound-label">Âm thanh</span>
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <button
          aria-current={screen === 'home' ? 'page' : undefined}
          onClick={() => navigate('home')}
        >
          Trang chủ
        </button>
        <button
          aria-current={['library', 'setup', 'game'].includes(screen) ? 'page' : undefined}
          onClick={() => navigate('library')}
        >
          Gõ chữ
        </button>
        <button
          disabled={!canClassroom}
          title={canClassroom ? 'Mở lớp học' : 'Giáo viên cần thêm bạn vào lớp trước'}
          aria-current={screen === 'classroom' ? 'page' : undefined}
          onClick={() => navigate('classroom')}
        >
          Lớp học
        </button>
        <Account
          onUser={setUser}
          onCatalog={setCatalog}
          onClasses={setClasses}
          onOpen={setAccountOpen}
          onReady={setBootstrapReady}
          onAvatarChanged={(value) => setMyAvatar({ userId: user?.user_id, value })}
        />
      </nav>
      <Suspense fallback={<Loading label="Đang mở trang…" />}>
        {screen === 'classroom' ? (
          <Reveal key={user?.user_id || 'guest'}>
            {canClassroom ? (
              <ClassroomPage
                user={user}
                classes={classes}
                cache={classroomCache.current}
                avatarOverride={myAvatar?.userId === user.user_id ? myAvatar.value : null}
              />
            ) : (
              <main className="classroom-page">
                <section className="panel">
                  <h1>Lớp học</h1>
                  <p>Bạn cần đăng nhập và được giáo viên thêm vào lớp.</p>
                </section>
              </main>
            )}
          </Reveal>
        ) : screen === 'home' ? (
          <Reveal key="home">
            <HomePage
              ready={bootstrapReady}
              onPlay={() => navigate('library')}
              onClassroom={() => navigate('classroom')}
              canClassroom={canClassroom}
            />
          </Reveal>
        ) : screen === 'library' ? (
          <Reveal key="library">
            <GameLibrary catalog={catalog} onChoose={navigate} onHome={() => navigate('home')} />
          </Reveal>
        ) : screen === 'setup' ? (
          <Reveal key="setup">
            <TypingSetup
              settings={settings}
              setSettings={setSettings}
              onHome={() => navigate('library')}
              onStart={start}
            />
          </Reveal>
        ) : (
          <TypingGame
            settings={runSettings}
            user={user}
            onHome={() => navigate('home')}
            onSetup={() => navigate('setup')}
            onFinish={finish}
            sound={play}
            audioOpen={audioOpen || accountOpen}
            onPlayingChange={setGamePlaying}
          />
        )}
      </Suspense>
      {audioOpen && (
        <AudioSettings
          preferences={preferences}
          onChange={setPreferences}
          onClose={() => setAudioOpen(false)}
        />
      )}
      <footer>
        <span>
          TIPY STEM <i>✦</i> Khơi mở tiềm năng từ những điều nhỏ
        </span>
        <span>Được tạo cho những đôi tay ham học hỏi.</span>
      </footer>
    </>
  );
}
