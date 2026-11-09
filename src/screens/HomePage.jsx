import { ArrowRight, Keyboard, Puzzle, Users, MapPin, Sparkles, Check } from 'lucide-react';
import Reveal from '../shared/Reveal.jsx';

/** Public introduction. Game cards and scores belong exclusively to GameLibrary. */
export default function HomePage({ onPlay, onClassroom, canClassroom }) {
  return (
    <main className="welcome-page">
      <section className="hero welcome-hero">
        <div className="hero-copy">
          <span className="eyebrow">✦ TIPY STEM CẨM LỆ · HỌC VUI MỖI NGÀY</span>
          <h1>
            Học thật vui.
            <br />
            Sáng tạo <span>thật hay.</span>
          </h1>
          <p>
            Từ những phím gõ đầu tiên đến câu chuyện Scratch của riêng mình. Cùng TIPY STEM khám phá
            công nghệ trong một lớp học đầy niềm vui!
          </p>
          <button className="primary" onClick={onPlay}>
            Khám phá trò chơi <ArrowRight size={19} />
          </button>
          <div className="hero-meta">
            <span>
              <Check size={15} /> Học qua thực hành
            </span>
            <span>
              <Check size={15} /> Cùng bạn bè sáng tạo
            </span>
          </div>
        </div>
        <div className="learning-art" aria-label="Minh họa học gõ phím và lập trình Scratch">
          <span className="learning-sticker sticker-key">A</span>
          <span className="learning-sticker sticker-star">✦</span>
          <div className="scratch-scene">
            <div className="scene-dots">
              <i />
              <i />
              <i />
              <span>Ý tưởng của mình</span>
            </div>
            <div className="scene-content">
              <span className="scratch-cat">🐱</span>
              <span className="scene-bubble">Xin chào, thế giới! ✨</span>
              <div className="scene-ground" />
            </div>
          </div>
          <div className="scratch-blocks" aria-hidden="true">
            <span>🚩 Khi bắt đầu</span>
            <span>di chuyển 10 bước</span>
            <span>nói “Mình làm được!”</span>
          </div>
          <span className="learning-caption">
            <Sparkles size={16} /> Gõ phím · Kéo thả · Khám phá
          </span>
        </div>
      </section>
      <Reveal>
        <section className="learning-section" aria-labelledby="learn-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MỖI NGÀY MỘT ĐIỀU MỚI</span>
              <h2 id="learn-heading">Cùng TIPY học những gì?</h2>
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
                'Học cùng bạn bè, nhận bài từ giáo viên và chọn nhân vật con giáp yêu thích. Cùng nhau thử, cùng nhau tiến bộ.',
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
            <h2>Lớp học của những nhà sáng tạo nhỏ</h2>
            <p>
              Thử một cách làm mới, chia sẻ một ý tưởng hay và vui vì mình đã tiến bộ. Ở TIPY, mỗi
              bạn mang đến một màu sắc riêng cho lớp học.
            </p>
          </div>
          <div className="class-preview" aria-hidden="true">
            <span>🐯</span>
            <span>🐱</span>
            <span>🐲</span>
            <span>🐵</span>
          </div>
          <button className="secondary" disabled={!canClassroom} onClick={onClassroom}>
            Lớp học của mình <ArrowRight size={17} />
          </button>
          {!canClassroom && (
            <small>Đăng nhập và được giáo viên thêm vào lớp để mở lớp học của mình.</small>
          )}
        </section>
      </Reveal>
      <Reveal>
        <section className="location-card" aria-labelledby="location-heading">
          <div className="location-icon">
            <MapPin size={30} />
          </div>
          <div>
            <span className="eyebrow">GHÉ TIPY CÙNG HỌC NHÉ!</span>
            <h2 id="location-heading">TIPY STEM Cẩm Lệ</h2>
            <address>68 Phạm Tứ, Cẩm Lệ, Đà Nẵng</address>
            <p>Cùng học Typing, khám phá Scratch và tạo nên những giờ học vui nhộn.</p>
          </div>
          <a
            className="primary"
            href="https://www.google.com/maps/search/?api=1&query=68+Ph%E1%BA%A1m+T%E1%BB%A9%2C+C%E1%BA%A9m+L%E1%BB%87%2C+%C4%90%C3%A0+N%E1%BA%B5ng"
            target="_blank"
            rel="noopener noreferrer"
          >
            Xem đường đi <ArrowRight size={17} />
          </a>
        </section>
      </Reveal>
    </main>
  );
}
