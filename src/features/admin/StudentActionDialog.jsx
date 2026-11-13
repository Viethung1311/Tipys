import ValidatedForm from '../../components/ValidatedForm.jsx';
import { useRef, useState } from 'react';
import { Star, RotateCcw, StarOff } from 'lucide-react';
import Avatar from '../classroom/Avatar.jsx';
import Modal from '../../components/Modal.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { api } from '../../game/backend.js';

export default function StudentActionDialog({
  kind,
  student,
  classId,
  games = [],
  initialGameId,
  onClose,
  onDone,
}) {
  const gift = kind === 'gift';
  const deduct = kind === 'deduct';
  const adjustment = gift || deduct;
  const starsOnly = kind === 'stars';
  const actionLabel = gift
    ? 'Tặng sao'
    : deduct
      ? 'Trừ sao'
      : starsOnly
        ? 'Reset sao'
        : 'Làm lại từ đầu';
  const [requestId] = useState(() => crypto.randomUUID());
  const [gameId, setGameId] = useState(initialGameId || games[0]?.game_id || ''),
    [confirmation, setConfirmation] = useState(''),
    [amount, setAmount] = useState('1'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [attempted, setAttempted] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false);
  const valid = adjustment
    ? Number.isInteger(Number(amount)) &&
      Number(amount) > 0 &&
      Number(amount) <= (deduct ? Number(student.stars || 0) : 2147483647)
    : confirmation === 'accept' && (starsOnly || games.some((game) => game.game_id === gameId));
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current || !valid) return;
    inFlight.current = true;
    setAttempted(true);
    setBusy(true);
    setError('');
    try {
      const result = await api(
        gift ? 'star_gift' : deduct ? 'star_deduct' : starsOnly ? 'star_reset' : 'student_reset',
        {
          userId: student.user_id,
          requestId,
          ...(classId && { classId }),
          ...(adjustment
            ? { amount: Number(amount), message }
            : { ...(!starsOnly && { gameId }), confirm: confirmation }),
        },
      );
      if (!result.data?.completed)
        throw Error('Chưa xác nhận được kết quả. Hãy thử lại cùng yêu cầu.');
      window.dispatchEvent(
        new CustomEvent('tipy-points-changed', {
          detail: {
            userId: student.user_id,
            stars: result.data.stars,
            classIds: student.classes?.map((c) => c.class_id),
          },
        }),
      );
      try {
        localStorage.setItem(
          'tipy-stars-changed',
          JSON.stringify({
            userId: student.user_id,
            stars: result.data.stars,
            classIds: student.classes?.map((c) => c.class_id),
            requestId,
          }),
        );
      } catch {
        /* Other tabs refresh on focus if storage is unavailable. */
      }
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
      title={actionLabel}
      description={`Học sinh: ${student.full_name} · Tên đăng nhập: ${student.username}`}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <ValidatedForm className="account-form" onSubmit={submit}>
        {student.avatar && <Avatar value={student.avatar} name={student.full_name} />}
        {adjustment && (
          <p>
            Số sao hiện tại:{' '}
            <strong>{Number(student.stars || 0).toLocaleString('vi-VN')} sao</strong>.
          </p>
        )}
        {adjustment ? (
          <>
            <label>
              Số sao
              <input
                type="number"
                min="1"
                max={deduct ? Number(student.stars || 0) : 2147483647}
                step="1"
                required
                value={amount}
                disabled={busy || attempted}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              {deduct ? 'Lý do (không bắt buộc)' : 'Lời nhắn (không bắt buộc)'}
              <textarea
                maxLength={240}
                rows={3}
                value={message}
                disabled={busy || attempted}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p>
              {deduct
                ? `Còn lại sau khi trừ: ${valid ? Number(student.stars || 0) - Number(amount) : '—'} sao. Giữ tiến độ và mức sao tốt nhất từng bài.`
                : 'Sao tặng cộng vào tổng sao và bảng xếp hạng sao của lớp. Điểm Chữ rơi · Khó không đổi.'}
            </p>
          </>
        ) : (
          <>
            {starsOnly ? (
              <>
                <p>
                  Số sao hiện tại:{' '}
                  <strong>{Number(student.stars || 0).toLocaleString('vi-VN')} sao</strong>.
                </p>
                <p>
                  Đưa tổng sao và sao xếp hạng lớp về 0, gồm sao bài học, sao tặng và thưởng tuần đã
                  nhận. Lưu lịch sử reset. Quà tặng và thưởng mới vẫn cộng bình thường.
                </p>
                <p>
                  Giữ tiến độ, kết quả và mức sao đã thưởng từng bài. Bài đã đủ 3 sao không nhận
                  lại; bài từ 2 lên 3 sao chỉ nhận thêm 1 sao. Điểm Chữ rơi · Khó không đổi.
                </p>
              </>
            ) : (
              <>
                <label>
                  Trò chơi cần đặt lại
                  <select
                    value={gameId}
                    disabled={busy || attempted}
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
                  Sẽ xóa kết quả, tiến độ, sao thành tích, trạng thái mở khóa và lượt chơi đang dở
                  của trò chơi đã chọn. Sao bài học của trò chơi này được thu hồi; học sinh có thể
                  nhận lại theo phần tăng thêm, tối đa 3 sao mỗi bài. Kết quả Chữ rơi chưa chốt được
                  xóa nếu chọn Chữ rơi.
                </p>
                <p>
                  <strong>Giữ nguyên tổng thời gian luyện tích lũy</strong>, tài khoản, nhân vật,
                  thành viên lớp, trò chơi khác, sao thầy cô tặng và thưởng tuần đã chốt. Không thể
                  hoàn tác.
                </p>
              </>
            )}
            <label>
              Gõ chính xác accept để xác nhận
              <input
                autoComplete="off"
                data-confirm="accept"
                value={confirmation}
                disabled={busy || attempted}
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
        {error && attempted && (
          <p>
            Thử lại giữ nguyên yêu cầu để tránh ghi trùng. Muốn đổi nội dung, hãy đóng và mở thao
            tác mới.
          </p>
        )}
        <div className="student-row-actions">
          <TipyButton emphasis="secondary" disabled={busy} onClick={onClose}>
            Hủy
          </TipyButton>
          <TipyButton
            type="submit"
            icon={gift ? Star : deduct ? StarOff : RotateCcw}
            className={adjustment ? '' : 'tipy-button--danger'}
            disabled={!valid}
            loading={busy}
            loadingLabel="Đang xử lý…"
          >
            {actionLabel}
          </TipyButton>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
