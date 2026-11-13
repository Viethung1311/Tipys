import ValidatedForm from './ValidatedForm.jsx';
import Avatar from '../features/classroom/Avatar.jsx';
import { normalizeAvatar } from '../characters/catalog.js';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../game/backend.js';
import Loading from './Loading.jsx';
import useDialogViewport from '../hooks/useDialogViewport.js';
import TipyButton from './TipyButton.jsx';
import { UserRound, LogIn, UserPlus, LogOut, X } from 'lucide-react';
import AvatarPicker from '../features/classroom/AvatarPicker.jsx';
import AccountPoints from './AccountPoints.jsx';
import '../styles/modal.css';
export default function Account({
  onUser,
  onCatalog,
  onClasses,
  onOpen,
  onReady,
  onAvatarChanged,
  companionVisible,
  onToggleCompanion,
  companionSize,
  onPreviewCompanion,
  onSaveCompanion,
}) {
  const [open, setOpen] = useState(false),
    [user, setUser] = useState(null),
    [configured, setConfigured] = useState(false),
    [mode, setMode] = useState('login');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState(null),
    [avatarLoading, setAvatarLoading] = useState(false),
    [avatarError, setAvatarError] = useState(''),
    [avatarRetry, setAvatarRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setAvatar(null);
    setAvatarError('');
    setAvatarLoading(!!user);
    if (user)
      api('avatar')
        .then((data) => {
          if (live) {
            const value = normalizeAvatar(data.avatar);
            setAvatar(value);
            onAvatarChanged?.(value, user.user_id);
          }
        })
        .catch((error) => {
          if (live) setAvatarError(error.message);
        })
        .finally(() => {
          if (live) setAvatarLoading(false);
        });
    return () => {
      live = false;
    };
  }, [user?.user_id, avatarRetry]);
  const currentUserId = useRef(user?.user_id);
  currentUserId.current = user?.user_id;
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
  const sending = useRef(false);
  const run = async (task) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (error) {
      setError(error.message);
    } finally {
      sending.current = false;
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
  return (
    <>
      {loading && <Loading fullscreen label="Đang mở vườn phím…" />}
      <div className="account-controls">
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
        <button
          className="avatar-button"
          type="button"
          aria-label="Chọn nhân vật"
          aria-haspopup="dialog"
          onClick={() => {
            setMode('avatar');
            show(true);
          }}
        >
          <Avatar value={avatar} name={user?.full_name || 'bạn'} eager />
        </button>
      </div>
      <AccountPoints key={user?.user_id || 'guest'} user={user} />
      <Dialog.Root open={open} onOpenChange={show}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <div className="dialog-viewport" style={viewportStyle}>
            <Dialog.Content
              className={`modal account-modal tipy-scrollbar-hidden ${mode === 'avatar' ? 'wide character-modal' : ''}`}
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <div className={mode === 'avatar' ? 'character-modal-header' : undefined}>
                {mode === 'avatar' && (
                  <Dialog.Close asChild>
                    <button
                      className="character-modal-close"
                      type="button"
                      aria-label="Đóng chọn nhân vật"
                    >
                      <X size={24} aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                )}
                <Dialog.Title>
                  {mode === 'avatar'
                    ? 'Chọn nhân vật'
                    : user
                      ? `Xin chào, ${user.full_name}!`
                      : mode === 'signup'
                        ? 'Tạo tài khoản nhỏ'
                        : 'Chào bạn trở lại!'}
                </Dialog.Title>
                <Dialog.Description>
                  {mode === 'avatar'
                    ? 'Chọn người bạn mà bạn thích nhé.'
                    : user
                      ? 'Cùng luyện tập và xem mình tiến bộ nhé.'
                      : 'Dùng tên đăng nhập và mật khẩu của bạn, không cần email.'}
                </Dialog.Description>
              </div>
              <div className={mode === 'avatar' ? 'character-modal-body' : undefined}>
                {!user && mode !== 'avatar' && (
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
                    <ValidatedForm onSubmit={submit} className="account-form">
                      {mode === 'signup' && (
                        <label>
                          Tên của bạn
                          <input
                            data-required-text
                            name="fullName"
                            autoComplete="name"
                            required
                            maxLength={100}
                          />
                        </label>
                      )}
                      <label>
                        Tên đăng nhập
                        <input
                          pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{0,39}"
                          data-format-message="Tên đăng nhập dùng chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới."
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
                          data-byte-limit="1024"
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
                    </ValidatedForm>
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
                      <button
                        aria-current={mode === 'account' ? 'page' : undefined}
                        onClick={() => setMode('account')}
                      >
                        Tài khoản
                      </button>
                      <button
                        aria-current={mode === 'avatar' ? 'page' : undefined}
                        onClick={() => setMode('avatar')}
                      >
                        Nhân vật
                      </button>
                      {user.role === 'admin' && <a href="/admin">Trang quản trị riêng →</a>}
                    </div>
                    {mode === 'account' && (
                      <div className="account-summary">
                        <Avatar value={avatar} name={user.full_name} />
                        <p>
                          Tên đăng nhập: <b>{user.username}</b>
                        </p>
                        <p>
                          Vai trò:{' '}
                          <b>{user.role === 'admin' ? 'Giáo viên quản trị' : 'Học sinh'}</b>
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
                  </>
                )}
                {mode === 'avatar' && (
                  <AvatarPicker
                    key={user?.user_id || 'guest'}
                    user={user}
                    initialValue={avatar}
                    loading={avatarLoading}
                    loadError={avatarError}
                    onRetry={() => setAvatarRetry((value) => value + 1)}
                    onLogin={() => setMode('login')}
                    companionVisible={companionVisible}
                    companionSize={companionSize}
                    onPreviewCompanion={onPreviewCompanion}
                    onToggleCompanion={onToggleCompanion}
                    onSaved={(value, size) => {
                      if (currentUserId.current !== user?.user_id) return;
                      onSaveCompanion?.(size);
                      setAvatar(normalizeAvatar(value));
                      onAvatarChanged?.(value, user?.user_id);
                    }}
                  />
                )}
                {busy && <Loading label="Đang tải…" />}
                {error && (
                  <p role="alert" className="account-error">
                    {error}
                  </p>
                )}
                {mode !== 'avatar' && (
                  <Dialog.Close asChild>
                    <button className="text-button centered">Đóng</button>
                  </Dialog.Close>
                )}
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
