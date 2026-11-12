import Avatar from '../features/classroom/Avatar.jsx';
import { Keyboard, Puzzle, Users, Sparkles, Check } from 'lucide-react';
import Reveal from '../shared/Reveal.jsx';
import TipyButton from '../components/TipyButton.jsx';
import scratchCat from '../assets/scratch-cat.jpg';
import scratchCondition from '../assets/scratch-condition.png';
import scratchMotion from '../assets/scratch-motion.png';

/** Public introduction. Game cards and scores belong exclusively to GameLibrary. */
export default function HomePage({ onPlay, onClassroom, canClassroom, ready = true }) {
  return (
    <main className="welcome-page">
      <section className={`hero welcome-hero ${ready ? 'hero-ready' : ''}`}>
        <div className="hero-copy">
          <span className="eyebrow hero-reveal hero-reveal-title">✦ Zunimo · HỌC VUI MỖI NGÀY</span>
          <h1 className="hero-reveal hero-reveal-title">
            Học thật vui.
            <br />
            Sáng tạo <span>thật hay.</span>
          </h1>
          <p className="hero-reveal hero-reveal-intro">
            {canClassroom
              ? 'Cùng Zunimo luyện gõ, sáng tạo với Scratch và khám phá bài học từ thầy cô trong lớp của mình.'
              : 'Từ những phím gõ đầu tiên đến câu chuyện Scratch của riêng mình. Cùng Zunimo luyện bàn phím và khám phá công nghệ mỗi ngày!'}
          </p>
          <TipyButton
            variant="learn"
            className="hero-reveal hero-reveal-actions"
            onClick={canClassroom ? onClassroom : onPlay}
          >
            {canClassroom ? 'Vào học' : 'Luyện bàn phím'}
          </TipyButton>
          <div className="hero-meta hero-reveal hero-reveal-actions">
            <span>
              <Check size={15} /> Học qua thực hành
            </span>
            <span>
              <Check size={15} /> Cùng bạn bè sáng tạo
            </span>
          </div>
        </div>
        <div
          className="learning-art scratch-showcase hero-reveal hero-reveal-art"
          aria-label="Khám phá Scratch qua nhân vật và khối lệnh"
        >
          <div className="scratch-showcase-heading">
            <span className="scratch-dot" /> Một ý tưởng nhỏ. Một thế giới mới.
          </div>
          <div className="scratch-sticker">
            <img
              src={scratchCat}
              alt="Mèo Scratch vui nhộn"
              width="657"
              height="559"
              fetchPriority="high"
              decoding="async"
            />
          </div>
          <div className="scratch-code-card code-card-condition">
            <span>01 · Thử một điều kiện</span>
            <img
              src={scratchCondition}
              alt="Khối Scratch: nếu chạm Apple thì nói Xin chào"
              width="535"
              height="284"
              decoding="async"
            />
          </div>
          <div className="scratch-code-card code-card-motion">
            <span>02 · Bắt đầu chuyển động</span>
            <img
              src={scratchMotion}
              alt="Khối Scratch đi tới điểm x 0, y 0"
              width="203"
              height="65"
              decoding="async"
            />
          </div>
          <span className="learning-caption">
            <Sparkles size={16} /> Gõ phím · Kéo thả · Sáng tạo
          </span>
        </div>
      </section>
      <Reveal>
        <section className="learning-section" aria-labelledby="learn-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MỖI NGÀY MỘT ĐIỀU MỚI</span>
              <h2 id="learn-heading">Cùng Zunimo học những gì?</h2>
            </div>
            <p>Một chút tò mò, thật nhiều niềm vui.</p>
          </div>
          <div className="learning-cards">
            {[
              [
                Keyboard,
                '⌨',
                'Học gõ phím',
                'Làm quen bàn phím, luyện đặt tay và gõ chính xác. Những trò chơi nhỏ giúp mỗi lần luyện tập trở nên thú vị hơn.',
                'typing',
              ],
              [
                Puzzle,
                '🧩',
                'Sáng tạo với Scratch',
                'Kéo thả các khối lệnh, tạo hoạt hình, kể chuyện và thử làm trò chơi. Từng ý tưởng nhỏ đều có thể trở thành một sản phẩm của riêng mình.',
                'scratch',
              ],
              [
                Users,
                '🌈',
                'Lớp học vui nhộn',
                canClassroom
                  ? 'Học cùng bạn bè, nhận bài từ giáo viên và chọn nhân vật yêu thích. Cùng nhau tiến bộ.'
                  : 'Góc học tập dành cho các bạn đã được giáo viên thêm vào lớp. Bạn có thể bắt đầu với trò chơi luyện bàn phím.',
                'class',
              ],
            ].map(([Icon, emoji, title, copy, id]) => (
              <article className={`learning-card learn-${id}`} key={id}>
                <span className="course-emoji" aria-hidden="true">
                  {emoji}
                </span>
                <Icon size={22} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="welcome-class panel">
          <div>
            <span className="eyebrow">MỘT GÓC NHỎ, NHIỀU KHÁM PHÁ</span>
            <h2>
              {canClassroom
                ? 'Lớp học của những nhà sáng tạo nhỏ'
                : 'Luyện mỗi ngày, tiến bộ từng phím'}
            </h2>
            <p>
              {canClassroom
                ? 'Thử một cách làm mới, chia sẻ ý tưởng và nhận bài từ giáo viên trong lớp Zunimo của mình.'
                : 'Chọn trò chơi, làm quen bàn phím và luyện theo nhịp của mình. Mỗi lần thử là một lần tiến bộ cùng Zunimo.'}
            </p>
          </div>
          <div className="class-preview" aria-hidden="true">
            {['icon_10', 'icon_24', 'icon_29', 'icon_06'].map((animal) => (
              <Avatar key={animal} value={{ animal }} />
            ))}
          </div>
          <TipyButton variant="learn" onClick={canClassroom ? onClassroom : onPlay}>
            {canClassroom ? 'Vào học' : 'Luyện bàn phím'}
          </TipyButton>
        </section>
      </Reveal>
    </main>
  );
}
