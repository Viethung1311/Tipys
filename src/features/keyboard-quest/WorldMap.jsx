import { useEffect, useRef } from 'react';
import { ArrowLeft, Lock, Play, Sprout, Trees, Bike, WandSparkles, Trophy } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import { WORLDS, LESSONS, isUnlocked } from './curriculum.js';
import TelexGuide from './TelexGuide.jsx';
const icons = [Sprout, Trees, Bike, WandSparkles, Trophy];
export default function WorldMap({ worldId, onChooseWorld, progress, onOpen, mode, onModeChange }) {
  const world = WORLDS.find((item) => item.id === worldId),
    heading = useRef(null),
    previousWorld = useRef(worldId);
  useEffect(() => {
    if (worldId !== null || previousWorld.current !== worldId) heading.current?.focus();
    previousWorld.current = worldId;
  }, [worldId]);
  return (
    <section className="quest-worlds" aria-labelledby="quest-map-heading">
      <h2 id="quest-map-heading" className="quest-map-heading" tabIndex={-1} ref={heading}>
        {world ? world.title : 'Chọn thế giới'}
      </h2>
      {!world ? (
        <div className="quest-world-grid">
          {WORLDS.map((item, index) => {
            const lessons = LESSONS.filter((lesson) => lesson.world === item.id),
              done = lessons.filter((lesson) =>
                progress.some((row) => row.lesson_id === lesson.id && row.completed),
              ).length;
            return (
              <TipyButton
                key={item.id}
                className="quest-world-tile"
                emphasis="secondary"
                icon={icons[index]}
                aria-label={item.title}
                onClick={() => onChooseWorld(item.id)}
              >
                <strong>{item.title}</strong>
                <small>
                  {done}/{lessons.length} bài hoàn thành
                </small>
              </TipyButton>
            );
          })}
        </div>
      ) : (
        <div className="panel quest-world">
          <div className="quest-world-controls">
            <TipyButton icon={ArrowLeft} emphasis="secondary" onClick={() => onChooseWorld(null)}>
              Các thế giới
            </TipyButton>
            <label>
              Kiểu chơi
              <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
                <option value="learn">Cùng học</option>
                <option value="race">Đua xe một mình</option>
              </select>
            </label>
          </div>
          {world.id === 4 && <TelexGuide />}
          <div className="quest-lessons">
            {LESSONS.filter((lesson) => lesson.world === world.id).map((lesson) => {
              const unlocked = isUnlocked(lesson, progress),
                row = progress.find((item) => item.lesson_id === lesson.id);
              return (
                <article className="quest-lesson" key={lesson.id}>
                  <h3>{lesson.title}</h3>
                  <p>
                    {lesson.demo ? 'Bài trải nghiệm · mở sẵn' : `Bước ${lesson.stage}`} ·{' '}
                    {row?.completed
                      ? `${row.best_stars} sao`
                      : unlocked
                        ? 'Sẵn sàng'
                        : 'Hoàn thành bài trước'}
                  </p>
                  <TipyButton
                    icon={unlocked ? Play : Lock}
                    disabled={!unlocked}
                    emphasis={row?.completed ? 'secondary' : undefined}
                    onClick={() => onOpen(lesson.id)}
                  >
                    {unlocked ? (row?.completed ? 'Luyện lại' : 'Vào học') : 'Chưa mở'}
                  </TipyButton>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
