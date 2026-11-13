import { Check, LogIn, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TipyButton from '../../components/TipyButton.jsx';
import { api } from '../../game/backend.js';
import Avatar from './Avatar.jsx';
import { CHARACTERS, characterFor, normalizeAvatar } from '../../characters/catalog.js';
import { companionSize as normalizeSize } from '../../characters/companion-settings.js';
export default function AvatarPicker({
  user,
  initialValue,
  loading,
  loadError,
  onRetry,
  onSaved,
  onLogin,
  companionVisible,
  onToggleCompanion,
  companionSize,
  onPreviewCompanion,
}) {
  const [value, setValue] = useState(() => normalizeAvatar(initialValue));
  const [size, setSize] = useState(() => normalizeSize(companionSize));
  useEffect(() => () => onPreviewCompanion?.(null), [onPreviewCompanion]);
  const resize = (next) => {
    setSize(next);
    onPreviewCompanion?.(next);
    setNotice('');
  };
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setValue(normalizeAvatar(initialValue));
  }, [initialValue]);
  const sending = useRef(false);
  const submit = async (event) => {
    event.preventDefault();
    if (sending.current) return;
    if (!user) {
      onLogin();
      return;
    }
    sending.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api('avatar_save', value);
      setValue(normalizeAvatar(data));
      onSaved(data, size);
      setNotice('Đã lưu nhân vật của bạn.');
    } catch (error) {
      setError(error.message);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  };
  return (
    <section className="account-avatar-editor" aria-label="Chọn nhân vật của mình">
      <form className="avatar-picker-form" onSubmit={submit}>
        <div
          className="character-picker-scroll tipy-scrollbar-hidden"
          role="region"
          aria-label="Danh sách nhân vật"
          tabIndex={0}
        >
          <div className="avatar-picker-preview">
            <Avatar value={value} name={user?.full_name || 'bạn'} />
            <div>
              <h3>Người bạn đồng hành</h3>
              <p>Dùng chung trong lớp và các trò chơi.</p>
            </div>
          </div>
          {loading && <p role="status">Đang tải nhân vật…</p>}
          {loadError && (
            <p role="alert">
              {loadError}{' '}
              <TipyButton emphasis="secondary" icon={RotateCcw} onClick={onRetry}>
                Thử lại
              </TipyButton>
            </p>
          )}
          <div className="character-picker-layout">
            <fieldset disabled={loading || saving || !!loadError}>
              <legend>Chọn một nhân vật</legend>
              <div className="character-options">
                {CHARACTERS.map((character) => (
                  <label
                    key={character.id}
                    className={
                      'character-option ' + (value.animal === character.id ? 'is-selected' : '')
                    }
                  >
                    <input
                      type="radio"
                      name="animal"
                      value={character.id}
                      checked={value.animal === character.id}
                      onChange={() => {
                        setValue({ ...value, animal: character.id });
                        setNotice('');
                      }}
                    />
                    <img
                      src={character.src}
                      alt=""
                      width="256"
                      height="256"
                      loading="lazy"
                      decoding="async"
                    />
                    <b>{character.name}</b>
                    {value.animal === character.id && (
                      <span className="character-selected">
                        <Check size={16} aria-hidden="true" /> Đang chọn
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <section className="companion-size-panel" aria-label="Kích thước bạn đồng hành">
              <h3>Kích thước</h3>
              <div className="companion-size-preview">
                <img
                  src={characterFor(value.animal).src}
                  alt="Xem trước kích thước"
                  style={{ width: size * 0.96, height: size * 0.96 }}
                />
              </div>
              <label htmlFor="companion-size">
                Nhỏ đến Lớn · <output>{size}%</output>
              </label>
              <input
                id="companion-size"
                type="range"
                min="60"
                max="160"
                step="1"
                value={size}
                disabled={!user || saving}
                onChange={(e) => resize(Number(e.target.value))}
              />
              <TipyButton
                emphasis="secondary"
                icon={RotateCcw}
                disabled={!user || saving}
                onClick={() => resize(100)}
              >
                Mặc định
              </TipyButton>
            </section>
          </div>
        </div>
        <footer className="character-confirm">
          <div className="character-confirm-actions">
            <TipyButton
              className="full"
              type="submit"
              icon={user ? Check : LogIn}
              disabled={loading || !!loadError}
              loading={saving}
              loadingLabel="Đang lưu…"
            >
              {user ? 'Lưu nhân vật' : 'Đăng nhập để lưu'}
            </TipyButton>
            <TipyButton
              emphasis="secondary"
              icon={companionVisible ? EyeOff : Eye}
              disabled={!user}
              onClick={onToggleCompanion}
              title={!user ? 'Đăng nhập để dùng người bạn đồng hành' : undefined}
            >
              {companionVisible ? 'Ẩn bạn' : 'Hiện bạn'}
            </TipyButton>
          </div>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="admin-success">
              {notice}
            </p>
          )}
        </footer>
      </form>
    </section>
  );
}
