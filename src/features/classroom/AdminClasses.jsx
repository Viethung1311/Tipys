import { useEffect, useState } from 'react';
import { api } from '../../game/backend.js';
import Loading from '../../components/Loading.jsx';
import RosterEditor from './RosterEditor.jsx';
/** Admin owns roster changes. Students have no enrollment write action. */
export default function AdminClasses({ students, initialClasses, onChanged, onMembersChanged }) {
  const [classes, setClasses] = useState(initialClasses || []),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [name, setName] = useState('');
  const current = classes.find((c) => c.class_id === selected);
  const load = async () => {
    const data = await api('classes');
    setClasses(data.classes);
  };
  useEffect(() => {
    if (initialClasses) {
      setBusy(false);
      return;
    }
    load()
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  const run = async (task) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      setNotice('Đã lưu thay đổi.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel admin-classes">
      <h2>🏫 Lớp học & thành viên</h2>
      <form
        className="class-create"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const result = (await api('class_save', { name })).data;
            setName('');
            await load();
            setSelected(result.class_id);
            await onChanged();
          });
        }}
      >
        <label>
          Tên lớp mới
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="Ví dụ: STEM 3A"
          />
        </label>
        <button className="primary" disabled={busy}>
          Tạo lớp mới
        </button>
      </form>
      <label className="class-select">
        Chọn lớp để quản lý
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Chọn lớp…</option>
          {classes.map((c) => (
            <option value={c.class_id} key={c.class_id}>
              {c.name}
              {c.archived_at ? ' · Đã xóa/lưu trữ' : ''}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <>
          <form
            className="class-create"
            key={current.class_id + current.name}
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get('name');
              run(async () => {
                await api('class_save', { classId: selected, name: value });
                await load();
                await onChanged();
              });
            }}
          >
            <label>
              Đổi tên lớp
              <input name="name" required maxLength={100} defaultValue={current.name} />
            </label>
            <button className="secondary" disabled={busy}>
              Lưu tên
            </button>
          </form>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api('class_archive', { classId: selected, archived: !current.archived_at });
                await load();
                await onChanged();
              })
            }
          >
            {current.archived_at ? 'Khôi phục lớp' : 'Xóa lớp (có thể khôi phục)'}
          </button>
          <p className="muted">
            Xóa sẽ ẩn lớp với học sinh; dữ liệu và bài đăng được giữ để khôi phục.
          </p>
          {!current.archived_at && (
            <>
              <RosterEditor
                key={selected}
                classId={selected}
                className={current.name}
                students={students}
                onMembersChanged={onMembersChanged}
              />
              <a className="lesson-link" href="/#classroom">
                Vào lớp để gửi bài, ảnh, file hoặc link →
              </a>
            </>
          )}
        </>
      )}
      {busy && <Loading label="Đang cập nhật lớp…" />}
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
