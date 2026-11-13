import ValidatedForm from '../../components/ValidatedForm.jsx';
import { useEffect, useRef, useState } from 'react';
import { History, LockKeyhole, Trash2, Star, RotateCcw } from 'lucide-react';
import ActionMenu from '../../components/ActionMenu.jsx';
import StudentActionDialog from './StudentActionDialog.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import Modal from '../../components/Modal.jsx';
import { api } from '../../game/backend.js';
import { practiceTime } from '../../game/results.js';
import Pagination from './Pagination.jsx';
import useStudentsPage from './useStudentsPage.js';
import './students.css';

export default function StudentsTable({ classes, onResults, onChanged, onData }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [classFilter, setClassFilter] = useState('all'),
    [sort, setSort] = useState('desc'),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState(null),
    [giftTarget, setGiftTarget] = useState(null),
    [resetTarget, setResetTarget] = useState(null),
    [confirmation, setConfirmation] = useState(''),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState('');
  const { data, loading, error } = useStudentsPage({ page, search, classFilter, sort }, revision);
  useEffect(() => {
    if (data) onData?.(data);
    if (data && data.page !== page) setPage(data.page);
  }, [data]);
  const filter = (setter, value) => {
    setter(value);
    setPage(1);
  };
  const sending = useRef(false);
  const update = async (task) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setFailure('');
    setNotice('');
    try {
      await task();
      setRevision((n) => n + 1);
      await onChanged?.();
    } catch (e) {
      setFailure(e.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="panel admin-students">
      <h2>Thời gian luyện tập của từng học sinh</h2>
      <div className="roster-filters">
        <label>
          Tìm học sinh
          <input
            type="search"
            value={search}
            onChange={(e) => filter(setSearch, e.target.value)}
            placeholder="Tên hoặc tên đăng nhập"
          />
        </label>
        <label>
          Lọc lớp
          <select
            aria-label="Lọc lớp"
            value={classFilter}
            onChange={(e) => filter(setClassFilter, e.target.value)}
          >
            <option value="all">Tất cả</option>
            <option value="none">Chưa có lớp</option>
            {classes
              .filter((c) => !c.archived_at)
              .map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Thời gian luyện
          <select
            aria-label="Thời gian luyện"
            value={sort}
            onChange={(e) => filter(setSort, e.target.value)}
          >
            <option value="desc">Nhiều nhất trước</option>
            <option value="asc">Ít nhất trước</option>
          </select>
        </label>
      </div>
      {loading && <p role="status">Đang tải học sinh…</p>}
      {(error || failure) && (
        <p role="alert" className="account-error">
          {error || failure} <button onClick={() => setRevision((n) => n + 1)}>Thử lại</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="table-scroll" role="region" aria-label="Danh sách học sinh" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {[
                'Học sinh',
                'Tên đăng nhập',
                'Lớp học',
                'Tổng thời gian luyện',
                'Tổng lượt',
                'Tổng sao',
                'Trạng thái',
                'Thao tác',
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.students.map((s) => (
              <tr key={s.user_id}>
                <td>{s.full_name}</td>
                <td>{s.username}</td>
                <td>{s.classes.map((c) => c.name).join(', ') || 'Chưa có lớp'}</td>
                <td>{practiceTime(s.total_active_seconds)}</td>
                <td>{s.total_plays}</td>
                <td>{Number(s.stars || 0).toLocaleString('vi-VN')}</td>
                <td>{s.is_active ? 'Đang mở' : 'Đã khóa'}</td>
                <td>
                  <ActionMenu
                    description={`${s.full_name} · ${s.username}`}
                    disabled={loading || busy || !!error}
                    items={[
                      { label: 'Xem kết quả', icon: History, onClick: () => onResults(s) },
                      { label: 'Tặng sao', icon: Star, onClick: () => setGiftTarget(s) },
                      { label: 'Reset sao', icon: RotateCcw, onClick: () => setResetTarget(s) },
                      {
                        label: s.is_active ? 'Khóa tài khoản' : 'Mở tài khoản',
                        icon: LockKeyhole,
                        onClick: () =>
                          update(() =>
                            api('student_active', { userId: s.user_id, active: !s.is_active }),
                          ),
                      },
                      {
                        label: 'Xóa tài khoản',
                        icon: Trash2,
                        danger: true,
                        onClick: () => {
                          setTarget(s);
                          setConfirmation('');
                          setFailure('');
                        },
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.total === 0 && !loading && <p>Không có học sinh phù hợp.</p>}
      </div>
      {data && <Pagination {...data} disabled={loading || busy || !!error} onPage={setPage} />}
      {target && (
        <Modal
          className="admin-delete-dialog"
          title="Xóa tài khoản thật"
          description={`Học sinh: ${target.full_name} · Tên đăng nhập: ${target.username}`}
          onClose={() => {
            if (!busy) setTarget(null);
          }}
        >
          <p>
            Sẽ xóa tài khoản đăng nhập, hồ sơ, nhân vật, kết quả, thời gian luyện, tiến độ bài học
            và quan hệ thành viên của học sinh. Không thể hoàn tác. Lớp học, tài liệu dùng chung và
            tài khoản khác được giữ nguyên.
          </p>
          <ValidatedForm
            onSubmit={() => {
              if (confirmation !== target.username) return;
              return update(async () => {
                const result = await api('student_delete', {
                  userId: target.user_id,
                  confirmUsername: confirmation,
                });
                if (!result.data?.deleted) throw Error('Chưa xác minh xóa tài khoản.');
                setTarget(null);
                setNotice('Đã xóa tài khoản và xác minh hoàn tất.');
              });
            }}
          >
            <label>
              Nhập lại tên đăng nhập
              <input
                autoComplete="off"
                data-confirm={target.username}
                value={confirmation}
                disabled={busy}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {failure && (
              <p role="alert" className="account-error">
                {failure}
              </p>
            )}
            <div className="student-row-actions">
              <TipyButton emphasis="secondary" disabled={busy} onClick={() => setTarget(null)}>
                Hủy
              </TipyButton>
              <TipyButton
                className="student-delete"
                icon={Trash2}
                disabled={confirmation !== target.username}
                loading={busy}
                loadingLabel="Đang xóa…"
                type="submit"
              >
                Xóa tài khoản
              </TipyButton>
            </div>
          </ValidatedForm>
        </Modal>
      )}
      {giftTarget && (
        <StudentActionDialog
          kind="gift"
          student={giftTarget}
          onClose={() => setGiftTarget(null)}
          onDone={(data) => {
            setNotice(`Đã tặng ${data.amount} sao cho ${giftTarget.full_name}.`);
            setGiftTarget(null);
          }}
        />
      )}
      {resetTarget && (
        <StudentActionDialog
          kind="stars"
          student={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={(result) => {
            setNotice(
              `Đã reset sao của ${resetTarget.full_name}. Tổng sao hiện tại: ${result.stars}.`,
            );
            setResetTarget(null);
          }}
        />
      )}
    </section>
  );
}
