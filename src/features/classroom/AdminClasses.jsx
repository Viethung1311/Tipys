import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import Loading from '../../components/Loading.jsx';
import RosterEditor from './RosterEditor.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { Plus, Save, Archive, Trash2, RotateCcw } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
/** Admin owns roster changes. Students have no enrollment write action. */
export default function AdminClasses({ initialClasses, onChanged, onMembersChanged }) {
  const [classes, setClasses] = useState(initialClasses || []),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [name, setName] = useState('');
  const current = classes.find((c) => c.class_id === selected);
  const [deletions, setDeletions] = useState([]),
    [target, setTarget] = useState(null),
    [confirmName, setConfirmName] = useState(''),
    [deleting, setDeleting] = useState(false),
    [deleteError, setDeleteError] = useState('');
  const inFlight = useRef(false);
  const loadDeletions = async () => setDeletions((await api('class_deletions')).deletions || []);
  const openDelete = (value) => {
    setTarget(value);
    setConfirmName('');
    setDeleteError('');
  };
  const removeClass = async () => {
    if (inFlight.current || confirmName !== target.name) return;
    inFlight.current = true;
    setDeleting(true);
    setDeleteError('');
    setError('');
    setNotice('');
    try {
      const { data } = await api('class_delete', { classId: target.class_id, confirmName });
      if (!data.deleted) throw new Error('Chưa xác nhận được việc xóa lớp.');
      setClasses((rows) => rows.filter((row) => row.class_id !== target.class_id));
      setSelected((value) => (value === target.class_id ? '' : value));
      setNotice(data.message);
      setTarget(null);
      if (data.cleanupPending)
        setDeletions((rows) => [...rows.filter((row) => row.class_id !== target.class_id), target]);
      else setDeletions((rows) => rows.filter((row) => row.class_id !== target.class_id));
      try {
        await onChanged();
        await loadDeletions();
      } catch {
        setError('Lớp đã xóa, nhưng chưa cập nhật được danh sách. Hãy tải lại trang.');
      }
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  };
  const load = async () => {
    const data = await api('classes');
    setClasses(data.classes);
  };
  useEffect(() => {
    loadDeletions().catch((e) => setError(e.message));
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
      <h2>🏫 Lớp học & thành viên ({classes.length})</h2>
      {deletions.map((row) => (
        <p key={row.class_id} role="status">
          Lớp “{row.name}” đã xóa, còn tệp cần dọn.{' '}
          <TipyButton
            emphasis="secondary"
            icon={RotateCcw}
            disabled={deleting}
            onClick={() => openDelete(row)}
          >
            Dọn tệp còn lại
          </TipyButton>
        </p>
      ))}
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
        <TipyButton type="submit" icon={Plus} disabled={busy}>
          Tạo lớp mới
        </TipyButton>
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
            <TipyButton type="submit" emphasis="secondary" icon={Save} disabled={busy}>
              Lưu tên
            </TipyButton>
          </form>
          <TipyButton
            emphasis="secondary"
            icon={Archive}
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
          </TipyButton>
          {current.archived_at && (
            <TipyButton
              className="tipy-button--danger"
              icon={Trash2}
              disabled={busy || deleting}
              onClick={() => openDelete(current)}
            >
              Xóa vĩnh viễn
            </TipyButton>
          )}
          <p className="muted">
            Xóa sẽ ẩn lớp với học sinh; dữ liệu và bài đăng được giữ để khôi phục.
          </p>
          {!current.archived_at && (
            <>
              <RosterEditor
                key={selected}
                classId={selected}
                className={current.name}
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
      {target && (
        <Modal
          title="Xóa vĩnh viễn lớp"
          description="Không thể khôi phục sau khi xác nhận."
          className="admin-delete-dialog"
          onClose={deleting ? undefined : () => setTarget(null)}
        >
          <p>
            Xóa lớp <strong>{target.name}</strong>, quan hệ thành viên, bài đăng và tệp chỉ thuộc
            lớp này. Tệp đang được nơi khác sử dụng được giữ lại.
          </p>
          <p>
            Không xóa tài khoản học sinh, nhân vật hoặc kết quả chơi. Hệ thống hiện chưa có dữ liệu
            bình luận.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              removeClass();
            }}
          >
            <label>
              Nhập đúng tên lớp: {target.name}
              <input
                autoComplete="off"
                value={confirmName}
                disabled={deleting}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </label>
            {deleteError && (
              <p role="alert" className="account-error">
                {deleteError}
              </p>
            )}
            <TipyButton
              type="submit"
              className="tipy-button--danger"
              icon={Trash2}
              loading={deleting}
              loadingLabel="Đang xóa…"
              disabled={deleting || confirmName !== target.name}
            >
              Xác nhận xóa
            </TipyButton>
          </form>
        </Modal>
      )}
    </section>
  );
}
