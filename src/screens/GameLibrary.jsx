import { ArrowLeft, Sparkles } from 'lucide-react';
import Reveal from '../shared/Reveal.jsx';
import TipyButton from '../components/TipyButton.jsx';
import { availableGames, gameScreen, GAME_ENGINES } from '../game/catalog.js';

/** Catalog metadata comes from the API; only registered engines are launchable. */
export default function GameLibrary({ catalog, onChoose, onHome }) {
  const games = availableGames(catalog);
  return (
    <main className="game-library">
      <button className="text-button" onClick={onHome}>
        <ArrowLeft size={17} /> Về trang chủ
      </button>
      <div className="page-title">
        <span className="eyebrow">KHO TRÒ CHƠI Zunimo</span>
        <h1>
          Gõ chữ, chơi thật vui<span>.</span>
        </h1>
        <p>Chọn một trò chơi, luyện từng chút và khám phá thêm điều mới!</p>
      </div>
      <section className="games-section" aria-label="Danh sách trò chơi">
        <div className="section-heading">
          <h2>Hôm nay, mình chơi gì?</h2>
          <span className="section-note">Luyện một chút. Giỏi hơn mỗi ngày.</span>
        </div>
        {games.map((game) => {
          const screen = gameScreen(game),
            engine = GAME_ENGINES[game.engine_code];
          return (
            <Reveal key={game.game_id}>
              <article className="game-card">
                <div className="card-art" aria-hidden="true">
                  <span className="mini-cloud">☁</span>
                  <span className="mini-letter ml-a">A</span>
                  <span className="mini-letter ml-f">F</span>
                  <span className="mini-letter ml-j">J</span>
                  <span className="mini-ground" />
                  <span className="mini-star">✦</span>
                </div>
                <div className="card-copy">
                  <span className={`tag ${screen ? 'green' : ''}`}>
                    <i />
                    {screen ? 'SẴN SÀNG CHƠI' : 'SẮP RA MẮT'}
                  </span>
                  <h3>{game.game_name}</h3>
                  <p>{game.description || 'Một thử thách mới đang chờ bạn khám phá.'}</p>
                  <div className="card-features">
                    {engine?.features.map((text) => (
                      <span key={text}>{text}</span>
                    ))}
                  </div>
                </div>
                <TipyButton variant="play" disabled={!screen} onClick={() => onChoose(screen)}>
                  {screen ? 'Chơi' : 'Đang chuẩn bị'}
                </TipyButton>
              </article>
            </Reveal>
          );
        })}
        {!games.length && (
          <section className="panel">
            <p>Giáo viên đang chuẩn bị trò chơi. Bạn ghé lại sau nhé!</p>
          </section>
        )}
        <div className="more-games">
          <Sparkles size={22} />
          <div>
            <h3>Thêm trò chơi, thêm khám phá</h3>
            <p>Những trò chơi mới sẽ xuất hiện ở đây khi được mở.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
