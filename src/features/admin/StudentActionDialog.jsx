import { useRef, useState } from 'react';
import { Star, RotateCcw } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { api } from '../../game/backend.js';

export default function StudentActionDialog({
  kind,
  student,
  games = [],
  initialGameId,
  onClose,
  onDone,
}) {
  const gift = kind === 'gift';
  const [requestId] = useState(() => crypto.randomUUID());
  const [gameId, setGameId] = useState(initialGameId || games[0]?.game_id || ''),
    [confirmation, setConfirmation] = useState(''),
    [amount, setAmount] = useState('1'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false);
  const valid = gift
    ? Number.isInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= 2147483647
    : confirmation === 'accept' && games.some((game) => game.game_id === gameId);
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current || !valid) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api(gift ? 'star_gift' : 'student_reset', {
        userId: student.user_id,
        requestId,
        ...(gift ? { amount: Number(amount), message } : { gameId, confirm: confirmation }),
      });
      if (!result.data?.completed)
        throw Error('Chưa xác nhận được kết quả. Hãy thử lại cùng yêu cầu.');
      window.dispatchEvent(new Event('tipy-points-changed'));
      onDone(result.data);
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      className="admin-delete-dialog"
      title={gift ? 'Tặng sao' : 'Làm lại từ đầu'}
      description={`Học sinh: ${student.full_name} · ${student.username}`}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <form className="account-form" onSubmit={submit}>
        {gift ? (
          <>
            <label>
              Số sao
              <input
                type="number"
                min="1"
                max="2147483647"
                step="1"
                required
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Lời nhắn (không bắt buộc)
              <textarea
                maxLength={240}
                rows={3}
                value={message}
                disabled={busy}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p>Sao tặng được cộng vào Sao của bạn. Không tính vào hai bảng xếp hạng lớp.</p>
          </>
        ) : (
          <>
            <label>
              Trò chơi cần đặt lại
              <select
                value={gameId}
                disabled={busy}
                onChange={(e) => {
                  setGameId(e.target.value);
                  setConfirmation('');
                }}
              >
                {games.map((game) => (
                  <option key={game.game_id} value={game.game_id}>
                    {game.game_name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Sẽ xóa kết quả, tiến độ, sao thành tích, trạng thái mở khóa và lượt chơi đang dở của
              trò chơi đã chọn. Sao bài học của trò chơi này được thu hồi; học sinh có thể nhận lại
              một lần khi hoàn thành lại. Kết quả Chữ rơi chưa chốt được xóa nếu chọn Chữ rơi.
            </p>
            <p>
              <strong>Giữ nguyên tổng thời gian luyện tích lũy</strong>, tài khoản, nhân vật, thành
              viên lớp, trò chơi khác, sao thầy cô tặng và thưởng tuần đã chốt. Không thể hoàn tác.
            </p>
            <label>
              Gõ chính xác accept để xác nhận
              <input
                autoComplete="off"
                value={confirmation}
                disabled={busy}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="account-error">
            {error}
          </p>
        )}
        <div className="student-row-actions">
          <TipyButton emphasis="secondary" disabled={busy} onClick={onClose}>
            Hủy
          </TipyButton>
          <TipyButton
            type="submit"
            icon={gift ? Star : RotateCcw}
            className={gift ? '' : 'tipy-button--danger'}
            disabled={!valid}
            loading={busy}
            loadingLabel="Đang xử lý…"
          >
            {gift ? 'Tặng sao' : 'Làm lại từ đầu'}
          </TipyButton>
        </div>
      </form>
    </Modal>
  );
}
