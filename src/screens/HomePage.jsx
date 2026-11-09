import {
  ArrowRight,
  Keyboard as KeyboardIcon,
  Heart,
  Check,
  Sparkles,
  MousePointer2,
  ShieldCheck,
} from 'lucide-react';
import Leaderboard from '../components/Leaderboard.jsx';
export default function HomeScreen({ onPlay, gameEnabled = true, user }) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-star">✦</span> GÓC LUYỆN TẬP CỦA NHỮNG NHÀ KHÁM PHÁ NHỎ
          </span>
          <h1>
            Đôi tay nhỏ.
            <br />
            Khả năng <span>thật lớn.</span>
          </h1>
          <p>
            Biến từng lần gõ phím thành một niềm vui.
            <br />
            Cùng TIPY STEM luyện phản xạ, tự tin khám phá thế giới số!
          </p>
          <button className="primary" onClick={onPlay} disabled={!gameEnabled}>
            Cùng luyện phím nào <ArrowRight size={20} />
          </button>
          <div className="hero-meta">
            <span>
              <Check size={15} /> Không cần đăng nhập
            </span>
            <span>
              <Check size={15} /> Chơi trên mọi thiết bị
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-spark spark-one">✦</span>
          <span className="art-spark spark-two">✳</span>
          <span className="floating-key k-f">F</span>
          <span className="floating-key k-j">J</span>
          <span className="floating-key k-a">A</span>
          <div className="art-keyboard">
            {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, i) => (
              <div key={i}>
                {[...row].map((k) => (
                  <span key={k} className={'FGHJ'.includes(k) ? 'orange' : ''}>
                    {k}
                  </span>
                ))}
              </div>
            ))}
            <div>
              <span className="spacebar" />
            </div>
          </div>
          <span className="art-label">
            <Sparkles size={15} /> Mỗi phím gõ, một bước tiến!
          </span>
          <div className="smile">⌣</div>
        </div>
      </section>
      <section className="games-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HỌC QUA TRÒ CHƠI</span>
            <h2>Hôm nay, mình chơi gì?</h2>
          </div>
          <span className="section-note">Luyện một chút. Giỏi hơn mỗi ngày.</span>
        </div>
        <div className="game-card">
          <div className="card-art" aria-hidden="true">
            <span className="mini-cloud">☁</span>
            <span className="mini-letter ml-a">A</span>
            <span className="mini-letter ml-f">F</span>
            <span className="mini-letter ml-j">J</span>
            <span className="mini-ground" />
            <span className="mini-star">✦</span>
          </div>
          <div className="card-copy">
            <span className="tag green">
              <i /> SẴN SÀNG CHƠI
            </span>
            <h3>Chữ rơi</h3>
            <p>
              Bắt lấy những chữ cái bằng đôi tay nhanh nhẹn.
              <br />
              Bạn giữ được bao nhiêu chữ trước khi chúng chạm đất?
            </p>
            <div className="card-features">
              <span>
                <KeyboardIcon size={16} /> Chữ, số & dấu câu
              </span>
              <span>
                <Heart size={16} /> 3 mạng
              </span>
              <span>🌱 3 độ khó</span>
            </div>
          </div>
          <button className="primary" onClick={onPlay} disabled={!gameEnabled}>
            Chơi ngay <ArrowRight size={18} />
          </button>
        </div>
      </section>
      <Leaderboard user={user} />
      <section className="benefits">
        {[
          [KeyboardIcon, 'Quen phím, vững tay', 'Từng bước làm chủ bàn phím.'],
          [MousePointer2, 'Máy tính hay điện thoại', 'Gõ phím hoặc chạm để chơi.'],
          [ShieldCheck, 'An tâm khám phá', 'Không quảng cáo, luôn có thể chơi thử.'],
        ].map(([Icon, title, text]) => (
          <div key={title}>
            <span className="benefit-icon">
              <Icon size={22} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
