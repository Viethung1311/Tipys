import { useEffect, useRef, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { api, clearApiCache } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import ValidatedForm from '../../components/ValidatedForm.jsx';
import Modal from '../../components/Modal.jsx';
import Loading from '../../components/Loading.jsx';
import Pagination from './Pagination.jsx';

export default function Teachers({ classes }) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const sending = useRef(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    const timer = setTimeout(
      () =>
        api('teachers', undefined, { page, search })
          .then((r) => {
            if (live) setData(r);
          })
          .catch((e) => {
            if (live) setError(e.message);
          }),
      search ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [page, search, revision]);
  useEffect(() => {
    const refresh = () => {
      clearApiCache();
      setRevision((n) => n + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const save = async (e) => {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await api(
        draft.user_id ? 'teacher_save' : 'teacher_create',
        draft.user_id
          ? { userId: draft.user_id, classIds: draft.classIds, active: draft.is_active }
          : { ...draft },
      );
      setDraft(null);
      setNotice('Đã lưu giáo viên và lớp được phân công.');
      setRevision((n) => n + 1);
      window.dispatchEvent(new Event('tipy-class-access-changed'));
      try {
        localStorage.setItem('tipy-teachers-changed', crypto.randomUUID());
      } catch {}
    } catch (e) {
      setError(e.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="admin-section">
      <div className="admin-title">
        <h2>Giáo viên</h2>
        <TipyButton
          icon={Plus}
          onClick={() => {
            setError('');
            setDraft({
              fullName: '',
              username: '',
              password: '',
              classIds: [],
              requestId: crypto.randomUUID(),
            });
          }}
        >
          Tạo giáo viên
        </TipyButton>
      </div>
      <div className="account-form">
        <label>
          Tìm giáo viên
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            maxLength={100}
          />
        </label>
      </div>
      {notice && <p role="status">{notice}</p>}
      {!draft && error && (
        <p role="alert">
          {error}
          <TipyButton onClick={() => setRevision((n) => n + 1)}>Thử lại</TipyButton>
        </p>
      )}
      {!data && !error ? (
        <Loading label="Đang tải giáo viên…" />
      ) : (
        data && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Tên đăng nhập</th>
                    <th>Lớp được giao</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.user_id}>
                      <td>{t.full_name}</td>
                      <td>{t.username}</td>
                      <td>
                        {t.classIds
                          .map(
                            (id) =>
                              classes.find((c) => c.class_id === id)?.name || 'Lớp đã lưu trữ',
                          )
                          .join(', ') || 'Chưa phân công'}
                      </td>
                      <td>{t.is_active ? 'Đang hoạt động' : 'Đã khóa'}</td>
                      <td>
                        <TipyButton
                          icon={Save}
                          onClick={() => {
                            setError('');
                            setDraft({ ...t });
                          }}
                        >
                          Phân công / Khóa
                        </TipyButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && <p>Chưa có giáo viên phù hợp.</p>}
            <Pagination {...data} onPage={setPage} />
          </>
        )
      )}
      {draft && (
        <Modal
          title={draft.user_id ? `Phân công · ${draft.full_name}` : 'Tạo tài khoản giáo viên'}
          description="Chỉ Admin quản lý tài khoản và phân công lớp. Giáo viên không có quyền quản trị hệ thống."
          onClose={() => {
            if (!busy) setDraft(null);
          }}
        >
          <ValidatedForm className="account-form" onSubmit={save}>
            {!draft.user_id && (
              <>
                <label>
                  Họ tên
                  <input
                    required
                    data-required-text
                    maxLength={100}
                    value={draft.fullName}
                    onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  />
                </label>
                <label>
                  Tên đăng nhập
                  <input
                    required
                    pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{0,39}"
                    maxLength={40}
                    autoComplete="off"
                    value={draft.username}
                    onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  />
                </label>
                <label>
                  Mật khẩu / PIN
                  <input
                    type="password"
                    required
                    data-byte-limit="1024"
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  />
                </label>
              </>
            )}
            <fieldset disabled={busy}>
              <legend>Lớp được phân công</legend>
              {classes
                .filter((c) => !c.archived_at || draft.classIds.includes(c.class_id))
                .map((c) => (
                  <label className="tipy-choice" key={c.class_id}>
                    <input
                      type="checkbox"
                      checked={draft.classIds.includes(c.class_id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          classIds: e.target.checked
                            ? [...draft.classIds, c.class_id]
                            : draft.classIds.filter((id) => id !== c.class_id),
                        })
                      }
                    />
                    {c.name}
                    {c.archived_at ? ' (đã lưu trữ)' : ''}
                  </label>
                ))}
              {!classes.some((c) => !c.archived_at) && <p>Chưa có lớp đang mở.</p>}
            </fieldset>
            {draft.user_id && (
              <label className="tipy-choice">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                Cho phép đăng nhập
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            <TipyButton type="submit" icon={Save} loading={busy}>
              Lưu giáo viên
            </TipyButton>
          </ValidatedForm>
        </Modal>
      )}
    </section>
  );
}
