import { Save } from 'lucide-react';
import TipyButton from '../../components/TipyButton.jsx';
import { useEffect, useState } from 'react';
import { api } from '../../game/backend.js';
import Avatar from './Avatar.jsx';
import { ANIMALS, ACCESSORIES, COLORS } from './constants.js';

/** Account-level preferences: owned by the current user, independent of enrollment. */
export default function AvatarPicker({ user, onSaved }) {
  const [value, setValue] = useState({ animal: 'rat', accessory: 'none', color: 'sun' }),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    api('avatar')
      .then((data) => {
        if (live) setValue(data.avatar);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [user.user_id]);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api('avatar_save', value);
      setValue(data);
      onSaved?.(data);
      setNotice('Đã lưu nhân vật của bạn.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="account-avatar-editor" aria-label="Chọn nhân vật của mình">
      <div className="avatar-picker-preview">
        <Avatar value={value} name={user.full_name} />
        <div>
          <h3>Nhân vật của mình</h3>
          <p>Chọn một người bạn đồng hành cho ô của mình trong lớp.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={loading || saving}>
          <legend>12 con giáp</legend>
          <div className="zodiac-options">
            {ANIMALS.map(([id, emoji, name]) => (
              <label
                className={`zodiac-option ${value.animal === id ? 'is-selected' : ''}`}
                key={id}
              >
                <input
                  type="radio"
                  name="animal"
                  value={id}
                  checked={value.animal === id}
                  onChange={() => setValue({ ...value, animal: id })}
                />
                <span aria-hidden="true">{emoji}</span>
                <b>{name}</b>
              </label>
            ))}
          </div>
          <div className="avatar-controls">
            <label>
              Phụ kiện
              <select
                value={value.accessory}
                onChange={(e) => setValue({ ...value, accessory: e.target.value })}
              >
                {ACCESSORIES.map(([id, emoji, name]) => (
                  <option key={id} value={id}>
                    {emoji} {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Màu nền
              <select
                value={value.color}
                onChange={(e) => setValue({ ...value, color: e.target.value })}
              >
                {COLORS.map((id, i) => (
                  <option key={id} value={id}>
                    {['Vàng nắng', 'Xanh lá', 'Xanh trời', 'Hồng', 'Tím'][i]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <TipyButton
            icon={Save}
            className="full"
            type="submit"
            loading={saving}
            loadingLabel="Đang lưu…"
          >
            Lưu nhân vật
          </TipyButton>
        </fieldset>
      </form>
      {loading && <p role="status">Đang tải nhân vật…</p>}
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
