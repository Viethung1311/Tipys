import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import TipyButton from '../../components/TipyButton.jsx';
import { UserPlus, UserMinus } from 'lucide-react';

function SelectAll({ checked, mixed, disabled, onChange }) {
  const input = useRef(null);
  useEffect(() => {
    input.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="checkbox-target">
      <input
        ref={input}
        type="checkbox"
        aria-label="Chọn tất cả học sinh đang hiển thị"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

/** Selection stays local. Each add/remove submits once; failures preserve the selection. */
export default function RosterEditor({ classId, className, students, onMembersChanged }) {
  const [members, setMembers] = useState(new Set()),
    [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const ready = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    let live = true;
    api('class_roster', undefined, { classId })
      .then((data) => {
        if (live) {
          setMembers(new Set(data.userIds));
          ready.current = true;
        }
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
  }, [classId]);
  const refresh = async () => {
    if (inFlight.current) return;
    setLoading(true);
    setError('');
    try {
      const data = await api('class_roster', undefined, { classId });
      setMembers(new Set(data.userIds));
      setSelected(new Set());
      ready.current = true;
      setNotice('Đã làm mới danh sách thành viên.');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const normalized = query.trim().toLocaleLowerCase('vi-VN');
  const visible = students.filter(
    (s) =>
      `${s.full_name} ${s.username}`.toLocaleLowerCase('vi-VN').includes(normalized) &&
      (filter === 'all' ||
        (filter === 'members' ? members.has(s.user_id) : !members.has(s.user_id))),
  );
  const canSelect = (student) => student.is_active || members.has(student.user_id);
  const selectable = visible.filter(canSelect),
    selectedVisible = selectable.filter((s) => selected.has(s.user_id)).length;
  const additions = students
    .filter((s) => selected.has(s.user_id) && !members.has(s.user_id) && s.is_active)
    .map((s) => s.user_id);
  const removals = students
    .filter((s) => selected.has(s.user_id) && members.has(s.user_id))
    .map((s) => s.user_id);
  const locked = loading || saving || !ready.current;
  const toggle = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((previous) => {
      const next = new Set(previous),
        all = selectable.length > 0 && selectedVisible === selectable.length;
      for (const student of selectable)
        all ? next.delete(student.user_id) : next.add(student.user_id);
      return next;
    });
  const save = async (active) => {
    const userIds = active ? additions : removals;
    if (!userIds.length || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api('class_members', { classId, userIds, active });
      setMembers((previous) => {
        const next = new Set(previous);
        for (const id of data.userIds) active ? next.add(id) : next.delete(id);
        return next;
      });
      setSelected((previous) => {
        const next = new Set(previous);
        for (const id of data.userIds) next.delete(id);
        return next;
      });
      onMembersChanged?.({ classId, className, userIds: data.userIds, active });
      setNotice(
        active
          ? `Đã thêm ${data.userIds.length} học sinh vào lớp.`
          : `Đã bỏ ${data.userIds.length} học sinh khỏi lớp.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <section className="roster-editor" aria-label="Chọn thành viên lớp">
      <div className="roster-heading">
        <h3>Thành viên · {members.size} học sinh</h3>
        <button className="text-button" disabled={loading || saving} onClick={refresh}>
          Làm mới thành viên
        </button>
      </div>
      <p>Chọn một hoặc nhiều bạn, rồi bấm Thêm vào lớp hoặc Bỏ khỏi lớp một lần.</p>
      <div className="roster-filters">
        <label>
          Tìm học sinh
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên hoặc tên đăng nhập"
          />
        </label>
        <label>
          Hiển thị
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tất cả học sinh</option>
            <option value="candidates">Chưa vào lớp</option>
            <option value="members">Đã vào lớp</option>
          </select>
        </label>
      </div>
      <div className="roster-actions" aria-busy={saving}>
        <span>
          Đã chọn <b>{selected.size}</b> bạn
        </span>
        <TipyButton
          icon={UserPlus}
          disabled={locked || !additions.length}
          onClick={() => save(true)}
        >
          Thêm vào lớp ({additions.length})
        </TipyButton>
        <TipyButton
          emphasis="secondary"
          icon={UserMinus}
          disabled={locked || !removals.length}
          onClick={() => save(false)}
        >
          Bỏ khỏi lớp ({removals.length})
        </TipyButton>
        <button
          className="text-button"
          disabled={locked || !selected.size}
          onClick={() => setSelected(new Set())}
        >
          Bỏ chọn tất cả
        </button>
      </div>
      {(loading || saving) && (
        <p role="status" className="roster-pending">
          {saving ? 'Đang lưu danh sách đã chọn…' : 'Đang tải thành viên…'}
        </p>
      )}
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
      <div className="table-scroll" role="region" aria-label="Thành viên lớp" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>
                <SelectAll
                  checked={selectable.length > 0 && selectedVisible === selectable.length}
                  mixed={selectedVisible > 0 && selectedVisible < selectable.length}
                  disabled={locked || !selectable.length}
                  onChange={toggleAll}
                />
              </th>
              <th>Học sinh</th>
              <th>Tên đăng nhập</th>
              <th>Trong lớp</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => {
              const joined = members.has(student.user_id);
              return (
                <tr
                  key={student.user_id}
                  className={selected.has(student.user_id) ? 'roster-selected' : ''}
                >
                  <td>
                    <label className="checkbox-target">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${student.full_name} (${student.username})`}
                        checked={selected.has(student.user_id)}
                        disabled={locked || !canSelect(student)}
                        onChange={() => toggle(student.user_id)}
                      />
                    </label>
                  </td>
                  <td>
                    {student.full_name}
                    {!student.is_active && <small className="roster-inactive">Đã khóa</small>}
                  </td>
                  <td>{student.username}</td>
                  <td>{joined ? '✓ Đã vào lớp' : 'Chưa vào lớp'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && !loading && <p>Không có học sinh phù hợp.</p>}
      </div>
    </section>
  );
}
