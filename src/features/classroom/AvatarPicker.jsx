import { Check, LogIn, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import TipyButton from '../../components/TipyButton.jsx';
import { api } from '../../game/backend.js';
import Avatar from './Avatar.jsx';
import { CHARACTERS, normalizeAvatar } from '../../characters/catalog.js';
export default function AvatarPicker({
  user,
  initialValue,
  loading,
  loadError,
  onRetry,
  onSaved,
  onLogin,
}) {
  const [value, setValue] = useState(() => normalizeAvatar(initialValue));
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setValue(normalizeAvatar(initialValue));
  }, [initialValue]);
  const submit = async (event) => {
    event.preventDefault();
    if (!user) {
      onLogin();
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api('avatar_save', value);
      setValue(normalizeAvatar(data));
      onSaved(data);
      setNotice('Đã lưu nhân vật của bạn.');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="account-avatar-editor" aria-label="Chọn nhân vật của mình">
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
      <form onSubmit={submit}>
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
          <div className="character-confirm">
            <TipyButton
              className="full"
              type="submit"
              icon={user ? Check : LogIn}
              loading={saving}
              loadingLabel="Đang lưu…"
            >
              {user ? 'Lưu nhân vật' : 'Đăng nhập để lưu'}
            </TipyButton>
          </div>
        </fieldset>
      </form>
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
    </section>
  );
}
