import { Fragment, useEffect, useRef, useState } from 'react';
import { Pause, Volume2, Settings } from 'lucide-react';
import PlaySurface, { enterPlayFullscreen } from '../../components/PlaySurface.jsx';
import GuardWordInput from './GuardWordInput.jsx';
import GuardSettings from './GuardSettings.jsx';
import { api } from '../../game/backend.js';
import { guardLevel, validGuardSettings } from './settings.js';
import { guardWords } from './words.js';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import Modal from '../../components/Modal.jsx';
import AudioSettings from '../../components/AudioSettings.jsx';
import CompletionScreen from '../../components/CompletionScreen.jsx';
import useGameAudio from '../../hooks/useGameAudio.js';
import Avatar from '../classroom/Avatar.jsx';
import { GUARD_LEVEL } from './level.js';
import { createGuard, guardInput, guardTick, guardResult } from './engine.js';
import { ART, renderGuard } from './render.js';
import {
  GUARD_STEP,
  replayGuardAssessment,
  guardAssessmentInput,
  guardAssessmentTick,
  guardEvidence,
} from './assessment.js';
import './keyboard-guard.css';

export default function KeyboardGuard({
  localOnly = false,
  session,
  game,
  ready = true,
  onBack,
  onGameSaved,
  onPlayingChange,
  avatarOverride,
  assessment,
  externalPaused = false,
}) {
  const engine = useRef(null),
    canvas = useRef(null),
    labels = useRef(null),
    images = useRef({}),
    inputLayer = useRef(null);
  const assessmentRun = useRef(null),
    assessmentRef = useRef(assessment),
    externalRef = useRef(externalPaused);
  assessmentRef.current = assessment;
  externalRef.current = externalPaused;
  const [stage, setStage] = useState(1);
  const [runConfig, setRunConfig] = useState(() => guardLevel());
  const [localUser, setLocalUser] = useState(null);
  const user = localOnly ? localUser : session;
  const [remoteGame, setRemoteGame] = useState(null);
  const currentGame = remoteGame || game;
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false),
    aliveRef = useRef(true);
  const [startError, setStartError] = useState('');
  const chosenSettings = localOnly ? undefined : currentGame?.config;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [status, setStatus] = useState('intro');
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [flightMotion, setFlightMotion] = useState(!reduced);
  const [hud, setHud] = useState({
    score: 0,
    lives: GUARD_LEVEL.lives,
    energy: 0,
    wave: 1,
    destroyed: 0,
    rest: false,
  });
  const [artState, setArtState] = useState('loading');
  const [soundOpen, setSoundOpen] = useState(false),
    [leaving, setLeaving] = useState(false);
  const [result, setResult] = useState(null);
  const [entry, setEntry] = useState({ value: '', feedback: 'empty' });
  const { preferences, setPreferences, play } = useGameAudio(status === 'playing');
  const active = status !== 'intro';
  useEffect(() => {
    if (!assessment || artState !== 'ready' || assessmentRun.current) return;
    let run;
    try {
      run = replayGuardAssessment(assessment.section, assessment.attemptId, assessment.initial);
    } catch {
      setStartError(
        'Chưa khôi phục được lượt trên thiết bị. Em quay lại danh sách rồi thử tiếp nhé.',
      );
      return;
    }
    assessmentRun.current = run;
    engine.current = run.state;
    setRunConfig(run.state.config);
    setStatus(run.state.status);
    sync();
  }, [assessment, artState]);
  useEffect(() => {
    if (!assessment) return;
    if (externalPaused) pause();
    else resume();
  }, [externalPaused, artState]);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  useEffect(() => {
    onPlayingChange?.(status === 'playing');
    return () => onPlayingChange?.(false);
  }, [status, onPlayingChange]);
  useEffect(() => {
    if (!localOnly) return;
    let alive = true,
      generation = 0;
    const check = async () => {
      const current = ++generation;
      setLocalUser(null);
      setSettingsOpen(false);
      try {
        const data = await api('bootstrap');
        if (alive && current === generation) {
          setLocalUser(data.user);
          setAccountError('');
        }
      } catch {
        if (alive && current === generation)
          setAccountError('Chưa kết nối tài khoản local; Cài đặt chỉ mở khi xác minh được Admin.');
      }
    };
    check();
    window.addEventListener('tipy-session-changed', check);
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      generation++;
      window.removeEventListener('tipy-session-changed', check);
      window.removeEventListener('focus', check);
    };
  }, [localOnly]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReduced(media.matches);
      setFlightMotion(!media.matches);
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    let alive = true;
    const load = (src) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = async () => {
          try {
            await image.decode();
            resolve(image);
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = reject;
        image.src = src;
      });
    Promise.all(Object.entries(ART).map(async ([name, art]) => [name, await load(art.src)]))
      .then((entries) => {
        if (alive) {
          images.current = Object.fromEntries(entries);
          setArtState('ready');
        }
      })
      .catch(() => {
        if (alive) setArtState('error');
      });
    return () => {
      alive = false;
      images.current = {};
    };
  }, []);
  const syncEntry = () => {
    const s = engine.current;
    setEntry({ value: s.input, feedback: s.inputFeedback });
  };
  const sync = () => {
    const s = engine.current;
    syncEntry();
    setHud({
      score: s.score,
      lives: s.lives,
      energy: s.energy,
      wave: s.wave,
      destroyed: s.destroyed,
      rest: s.restUntil !== null,
    });
  };
  const start = async (motion = !reduced) => {
    if (startingRef.current || artState !== 'ready') return;
    enterPlayFullscreen();
    startingRef.current = true;
    setStarting(true);
    setStartError('');
    try {
      let settings;
      if (!localOnly) {
        const result = await api('guard_config');
        if (!aliveRef.current) return;
        if (!validGuardSettings(result.game?.config))
          throw new Error('Cấu hình game chưa sẵn sàng.');
        settings = result.game.config;
        setRemoteGame(result.game);
      }
      const config = guardLevel(settings, stage);
      setFlightMotion(motion);
      engine.current = createGuard(config);
      setRunConfig(config);
      setSettingsOpen(false);
      setResult(null);
      setLeaving(false);
      setSoundOpen(false);
      setStatus('playing');
      sync();
      play('start');
    } catch (e) {
      if (aliveRef.current) setStartError(e.message);
    } finally {
      startingRef.current = false;
      if (aliveRef.current) setStarting(false);
    }
  };
  const pause = () => {
    if (['playing', 'clearing'].includes(engine.current?.status)) {
      engine.current.resumeStatus = engine.current.status;
      engine.current.status = 'paused';
      setStatus('paused');
    }
  };
  const resume = () => {
    if (engine.current?.status === 'paused') {
      engine.current.status = engine.current.resumeStatus || 'playing';
      setStatus('playing');
    }
  };
  const typeWord = (value, options) => {
    if (engine.current) {
      if (assessmentRun.current) {
        guardAssessmentInput(assessmentRun.current, value, options);
        assessmentRef.current.onChange(guardEvidence(assessmentRun.current));
      } else guardInput(engine.current, value, options);
      syncEntry();
    }
  };
  useEffect(() => {
    if (!active) return;
    const down = (e) => {
      if (e.key === 'Escape' && !e.target.closest?.('[role="dialog"]')) {
        e.preventDefault();
        pause();
      }
    };
    const hide = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [active]);
  useEffect(() => {
    if (!active || result) return;
    let frame,
      last = null,
      accumulator = 0,
      lastSecond = -1,
      previousHud = '';
    const animate = (now) => {
      const s = engine.current;
      const dt = last === null ? 0 : (now - last) / 1000;
      last = now;
      if (assessmentRun.current) {
        if (!externalRef.current && ['playing', 'clearing'].includes(s.status)) {
          accumulator += Math.min(0.05, Math.max(0, dt));
          while (accumulator >= GUARD_STEP && ['playing', 'clearing'].includes(s.status)) {
            guardAssessmentTick(assessmentRun.current);
            accumulator -= GUARD_STEP;
          }
        } else accumulator = 0;
        if (Math.floor(s.time) !== lastSecond || ['won', 'lost'].includes(s.status)) {
          lastSecond = Math.floor(s.time);
          assessmentRef.current.onChange(guardEvidence(assessmentRun.current));
        }
      } else guardTick(s, dt);
      const events = s.events.splice(0);
      if (events.includes('lost') || events.includes('won')) {
        if (!assessmentRun.current) setResult(guardResult(s));
        setStatus(s.status);
        play(s.status === 'won' ? 'record' : 'finish');
      } else if (events.includes('damage')) play('missed');
      else if (events.includes('explosion')) play('correct');
      else if (events.includes('shot')) play('select');
      const signature = [
        s.score,
        s.lives,
        s.energy,
        s.wave,
        s.destroyed,
        s.restUntil !== null,
        s.input,
        s.inputFeedback,
        s.inputTargetId,
      ].join(':');
      if (signature !== previousHud) {
        previousHud = signature;
        sync();
      }
      if (canvas.current && labels.current)
        renderGuard(
          canvas.current,
          labels.current,
          s,
          images.current,
          reduced,
          flightMotion,
          inputLayer.current,
        );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, result, play, reduced, flightMotion]);
  const back = () => {
    engine.current = null;
    setStatus('intro');
    setResult(null);
    setLeaving(false);
    onBack?.();
  };

  if (assessment && !active && startError)
    return (
      <section role="alert">
        <p>{startError}</p>
        <TipyButton variant="back" onClick={onBack}>
          Quay lại
        </TipyButton>
      </section>
    );
  if (assessment && !active)
    return (
      <Loading
        label={
          artState === 'error'
            ? 'Chưa tải được ảnh. Em tải lại để thử nhé.'
            : 'Đang tải phi thuyền…'
        }
      />
    );
  const Surface = assessment ? Fragment : PlaySurface;
  if (!active)
    return (
      <main className="guard-intro">
        <div className="guard-intro-card">
          <span className="guard-eyebrow">
            {localOnly ? 'ZUNIMO · BẢN THỬ TẠI MÁY' : 'ZUNIMO · VỆ BINH KHÔNG GIAN'}
          </span>
          <img src="/guard-art/ship.png" alt="Tàu Vệ binh bàn phím" />
          <h1>Vệ binh bàn phím</h1>
          <p>Gõ đủ từ có dấu để bảo vệ tàu!</p>
          <p>
            {GUARD_LEVEL.lives} máu · {guardLevel(chosenSettings, stage).totalTargets} thiên thạch
            <br />
            Mỗi thiên thạch vỡ được {GUARD_LEVEL.points} điểm. Đủ {GUARD_LEVEL.energyMax} năng lượng
            có khiên!
          </p>
          <label>
            Màn chơi
            <select
              aria-label="Màn chơi"
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  Màn {n}
                </option>
              ))}
            </select>
          </label>
          {accountError && <small>{accountError}</small>}
          {startError && <p role="alert">{startError}</p>}
          {!localOnly && ready && !currentGame?.is_active && (
            <p>Trò chơi chưa được mở. Em quay lại sau nhé.</p>
          )}
          <TipyButton
            variant="play"
            loading={starting || artState === 'loading'}
            disabled={artState === 'error' || (!localOnly && (!ready || !currentGame?.is_active))}
            onClick={() => start(true)}
          >
            {reduced ? 'Chơi có hiệu ứng bay' : 'Chơi'}
          </TipyButton>
          {reduced && (
            <>
              <p className="guard-motion-note">
                Trình duyệt đang bật giảm chuyển động. Em có thể chọn chơi ít chuyển động hoặc bật
                nền bay và lửa động cơ.
              </p>
              <TipyButton
                emphasis="secondary"
                disabled={
                  starting ||
                  artState !== 'ready' ||
                  (!localOnly && (!ready || !currentGame?.is_active))
                }
                onClick={() => start(false)}
              >
                Chơi ít chuyển động
              </TipyButton>
            </>
          )}
          {artState === 'error' && (
            <p role="alert">Chưa tải được ảnh. Em tải lại trang để thử nhé.</p>
          )}
          <p className="guard-motion-note">
            Từ ngắn từ {[...new Set(guardWords(stage).map((word) => word.topicTitle))].join(', ')}.
            Dùng bộ gõ tiếng Việt của máy để nhập dấu.
          </p>
          <small>Điểm và sao của lượt chơi không cộng vào tài khoản.</small>
          {onBack && (
            <TipyButton variant="back" onClick={onBack}>
              Về Gõ chữ
            </TipyButton>
          )}
        </div>
      </main>
    );
  return (
    <Surface>
      {starting && <Loading label="Đang mở lượt chơi…" />}
      {startError && (
        <p role="alert" className="guard-save-error">
          {startError}
        </p>
      )}
      {result ? (
        <CompletionScreen
          title={result.won ? 'Hoàn thành tốt' : 'Tàu cần nghỉ một chút!'}
          good={result.won}
          celebrate={result.won}
          background={ART.space0.src}
          scores={[[`${result.score} điểm`, 'Điểm']]}
          metrics={[
            [`${result.destroyed}/${runConfig.totalTargets}`, 'thiên thạch đã phá'],
            [`${result.accuracy}%`, 'chính xác'],
            [`${result.stars} sao`, 'trong lượt chơi'],
          ]}
          onBack={back}
          onRetry={() => start(flightMotion)}
          retryLabel="Chơi lại"
        />
      ) : (
        <section className="guard-game" aria-label="Vệ binh bàn phím">
          <aside className="guard-left" aria-label="Vùng điều khiển">
            {!assessment && (
              <TipyButton
                className="guard-exit"
                variant="back"
                size="compact"
                aria-label="Thoát"
                onClick={() => {
                  pause();
                  setLeaving(true);
                }}
              >
                Thoát
              </TipyButton>
            )}
          </aside>
          <div className="guard-center">
            <div className="guard-battle-slot">
              <div className="guard-battle" data-status={status}>
                <div className="guard-meters" aria-live="polite">
                  <img
                    width="768"
                    height="320"
                    src={ART[`hp${hud.lives}`].src}
                    alt={`Máu ${hud.lives}/${GUARD_LEVEL.lives}`}
                  />
                  <img
                    width="768"
                    height="320"
                    src={ART[`energy${hud.energy}`].src}
                    alt={`Năng lượng ${hud.energy}/${GUARD_LEVEL.energyMax}${hud.energy === GUARD_LEVEL.energyMax ? ' · Khiên sẵn sàng' : ''}`}
                  />
                </div>
                <canvas ref={canvas} aria-label="Gõ đủ từ tiếng Việt dưới thiên thạch để bắn." />
                <div ref={labels} className="guard-labels" aria-label="Các mục tiêu đang xuất hiện">
                  {Array.from({ length: runConfig.maxActive }, (_, i) => (
                    <span key={i} hidden />
                  ))}
                </div>
                <div ref={inputLayer} className="guard-input-layer" data-feedback={entry.feedback}>
                  <GuardWordInput
                    value={entry.value}
                    feedback={entry.feedback}
                    disabled={status !== 'playing'}
                    onValue={typeWord}
                  />
                </div>
                {hud.rest && (
                  <div className="guard-wave" role="status">
                    Tuyệt lắm! Chuẩn bị đợt {hud.wave + 1}…
                  </div>
                )}
              </div>
            </div>
            <footer className="guard-footer">
              <div className="guard-tools">
                {!assessment && (
                  <TipyButton icon={Pause} emphasis="secondary" size="compact" onClick={pause}>
                    Tạm dừng
                  </TipyButton>
                )}
                <TipyButton
                  icon={Volume2}
                  iconOnly
                  aria-label="Âm thanh"
                  emphasis="secondary"
                  size="compact"
                  onClick={() => {
                    pause();
                    setSoundOpen(true);
                  }}
                >
                  Âm thanh
                </TipyButton>
                {!assessment && user?.role === 'admin' && (
                  <TipyButton
                    icon={Settings}
                    iconOnly
                    aria-label="Cài đặt"
                    emphasis="secondary"
                    size="compact"
                    onClick={() => {
                      pause();
                      setSettingsOpen(true);
                    }}
                  >
                    Cài đặt
                  </TipyButton>
                )}
              </div>
            </footer>
          </div>
          <aside className="guard-player" aria-label="Thông tin người chơi thử">
            <div className="guard-score" aria-live="polite">
              <span>Điểm</span>
              <strong>{hud.score}</strong>
            </div>
            <Avatar
              value={avatarOverride || { animal: GUARD_LEVEL.previewPlayer.avatar }}
              name={user?.full_name || GUARD_LEVEL.previewPlayer.name}
              eager
            />
            <strong className="guard-player-name">
              {user?.full_name || GUARD_LEVEL.previewPlayer.name}
            </strong>
            <p>Màn {runConfig.stage} · Vệ binh bàn phím</p>
            <p>
              Đợt {hud.wave}/{runConfig.waves}
            </p>
            <span className="guard-progress">
              Đã phá {hud.destroyed}/{runConfig.totalTargets}
            </span>
          </aside>
        </section>
      )}
      {status === 'paused' && !externalPaused && !soundOpen && !leaving && !settingsOpen && (
        <Modal
          title="Tàu đang nghỉ"
          description="Thiên thạch và thời gian đều đã dừng."
          onClose={resume}
        >
          <TipyButton variant="play" onClick={resume}>
            Tiếp tục
          </TipyButton>
          <TipyButton
            emphasis="secondary"
            aria-pressed={flightMotion}
            onClick={() => setFlightMotion((value) => !value)}
          >
            {flightMotion ? 'Tắt hiệu ứng bay' : 'Bật hiệu ứng bay'}
          </TipyButton>
          <TipyButton variant="back" onClick={() => setLeaving(true)}>
            Quay lại
          </TipyButton>
        </Modal>
      )}
      {leaving && (
        <Modal
          title="Rời lượt chơi?"
          description={
            assessment
              ? 'Tiến trình được giữ trên thiết bị. Lịch và số lượt vẫn theo quy định.'
              : 'Điểm bản thử của lượt này sẽ không được giữ.'
          }
          onClose={() => setLeaving(false)}
        >
          <TipyButton variant="back" onClick={back}>
            Rời lượt chơi
          </TipyButton>
          <TipyButton
            variant="play"
            onClick={() => {
              setLeaving(false);
              resume();
            }}
          >
            Chơi tiếp
          </TipyButton>
        </Modal>
      )}
      {settingsOpen && user?.role === 'admin' && (
        <Modal
          title="Cài đặt Vệ binh bàn phím"
          description="Lượt hiện tại đã tạm dừng. Cấu hình mới áp dụng từ lượt tiếp theo."
          onClose={() => setSettingsOpen(false)}
        >
          <GuardSettings
            user={user}
            localOnly={localOnly}
            game={currentGame}
            onSaved={(saved) => {
              setRemoteGame(saved);
              onGameSaved?.(saved);
            }}
            initialStage={runConfig.stage}
            initialWave={hud.wave}
          />
          <TipyButton
            variant="play"
            onClick={() => {
              setSettingsOpen(false);
              resume();
            }}
          >
            Tiếp tục
          </TipyButton>
        </Modal>
      )}
      {soundOpen && (
        <AudioSettings
          preferences={preferences}
          onChange={setPreferences}
          onClose={() => setSoundOpen(false)}
        />
      )}
    </Surface>
  );
}
