import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../game/backend.js';
import Loading from './Loading.jsx';
import useDialogViewport from '../hooks/useDialogViewport.js';
import TipyButton from './TipyButton.jsx';
import { UserRound, LogIn, UserPlus, LogOut } from 'lucide-react';
import AvatarPicker from '../features/classroom/AvatarPicker.jsx';
import ResultsTable from './ResultsTable.jsx';
import { practiceTime } from '../game/results.js';
export default function Account({
  onUser,
  onCatalog,
  onClasses,
  onOpen,
  onReady,
  onAvatarChanged,
}) {
  const [open, setOpen] = useState(false),
    [user, setUser] = useState(null),
    [configured, setConfigured] = useState(false),
    [mode, setMode] = useState('login');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState([]),
    [loading, setLoading] = useState(true);
  const viewportStyle = useDialogViewport(open);
  const bootstrap = async () => {
    const data = await api('bootstrap');
    setConfigured(data.configured);
    setUser(data.user);
    onUser(data.user);
    onCatalog(data.configured ? data.games : null);
    onClasses?.(data.classes || []);
  };
  useEffect(() => {
    bootstrap()
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        onReady?.(true);
      });
  }, []);
  const show = (value) => {
    setOpen(value);
    onOpen(value);
    setError('');
  };
  const run = async (task) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    run(async () => {
      await api(mode, values);
      await bootstrap();
      setMode('account');
    });
  };
  const total = [
    ...new Map(history.map((row) => [row.game_id, row.total_active_seconds])).values(),
  ].reduce((n, s) => n + Number(s), 0);
  return (
    <>
      {loading && <Loading fullscreen label="Đang mở vườn phím…" />}
      <button
        className="account-button"
        title={user ? `Tài khoản · ${user.full_name}` : 'Tài khoản · Đăng nhập'}
        onClick={() => {
          setMode(user ? 'account' : 'login');
          show(true);
        }}
      >
        <UserRound size={17} aria-hidden="true" />
        <span className="account-label">
          {user ? `Tài khoản · ${user.full_name}` : 'Tài khoản · Đăng nhập'}
        </span>
      </button>
      <Dialog.Root open={open} onOpenChange={show}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <div className="dialog-viewport" style={viewportStyle}>
            <Dialog.Content
              className={`modal account-modal ${mode === 'history' ? 'wide' : ''}`}
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <Dialog.Title>
                {user
                  ? `Xin chào, ${user.full_name}!`
                  : mode === 'signup'
                    ? 'Tạo tài khoản nhỏ'
                    : 'Chào bạn trở lại!'}
              </Dialog.Title>
              <Dialog.Description>
                {user
                  ? 'Cùng luyện tập và xem mình tiến bộ nhé.'
                  : 'Dùng tên đăng nhập và mật khẩu của bạn, không cần email.'}
              </Dialog.Description>
              {!user && (
                <>
                  <div className="account-tabs">
                    <button
                      onClick={() => setMode('login')}
                      className={mode === 'login' ? 'active' : ''}
                    >
                      Đăng nhập
                    </button>
                    <button
                      onClick={() => setMode('signup')}
                      className={mode === 'signup' ? 'active' : ''}
                    >
                      Đăng ký
                    </button>
                  </div>
                  <form onSubmit={submit} className="account-form">
                    {mode === 'signup' && (
                      <label>
                        Tên của bạn
                        <input name="fullName" autoComplete="name" required maxLength={100} />
                      </label>
                    )}
                    <label>
                      Tên đăng nhập
                      <input
                        name="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck="false"
                        required
                        maxLength={40}
                        placeholder="Ví dụ: banan"
                      />
                    </label>
                    <label>
                      Mật khẩu
                      <input
                        name="password"
                        type="password"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        required
                        placeholder="Bạn tự chọn mật khẩu dễ nhớ"
                      />
                    </label>
                    <p className="muted">
                      Không bắt buộc chữ hoa, ký tự đặc biệt hoặc độ dài tối thiểu.
                    </p>
                    <TipyButton
                      type="submit"
                      icon={mode === 'signup' ? UserPlus : LogIn}
                      className="full"
                      loading={busy}
                      loadingLabel="Đang xử lý…"
                      disabled={!configured}
                    >
                      {mode === 'signup' ? 'Tạo tài khoản' : 'Vào chơi nào'}
                    </TipyButton>
                  </form>
                  {!configured && (
                    <p className="account-message">
                      Phần tài khoản đang được thiết lập. Bạn vẫn có thể chơi thử.
                    </p>
                  )}
                </>
              )}
              {user && (
                <>
                  <div className="account-tabs">
                    <button onClick={() => setMode('account')}>Tài khoản</button>
                    <button onClick={() => setMode('avatar')}>Nhân vật</button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          setHistory((await api('history')).history);
                          setMode('history');
                        })
                      }
                    >
                      Lịch sử chơi
                    </button>
                    {user.role === 'admin' && <a href="/admin">Trang quản trị riêng →</a>}
                  </div>
                  {mode === 'account' && (
                    <div className="account-summary">
                      <p>
                        Tên đăng nhập: <b>{user.username}</b>
                      </p>
                      <p>
                        Vai trò: <b>{user.role === 'admin' ? 'Giáo viên quản trị' : 'Học sinh'}</b>
                      </p>
                      <TipyButton
                        emphasis="secondary"
                        icon={LogOut}
                        className="full"
                        loading={busy}
                        loadingLabel="Đang thoát…"
                        onClick={() =>
                          run(async () => {
                            await api('logout', {});
                            await bootstrap();
                            setMode('login');
                          })
                        }
                      >
                        Đăng xuất
                      </TipyButton>
                    </div>
                  )}
                  {mode === 'avatar' && <AvatarPicker user={user} onSaved={onAvatarChanged} />}
                  {mode === 'history' && (
                    <>
                      <p className="practice-total">
                        Tổng thời gian luyện: <b>{practiceTime(total)}</b>
                      </p>
                      <p className="muted">
                        Chỉ giữ cao nhất và gần nhất cho mỗi game; tổng thời gian vẫn được cộng dồn.
                      </p>
                      <ResultsTable rows={history} />
                    </>
                  )}
                </>
              )}
              {busy && <Loading label="Đang tải…" />}
              {error && (
                <p role="alert" className="account-error">
                  {error}
                </p>
              )}
              <Dialog.Close asChild>
                <button className="text-button centered">Đóng</button>
              </Dialog.Close>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
