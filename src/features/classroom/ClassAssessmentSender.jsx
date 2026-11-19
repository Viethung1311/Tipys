import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import Modal from '../../components/Modal.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import { HubPages } from './ClassroomPage.jsx';
import { readHub } from './hub-cache.js';
export default function ClassAssessmentSender({ user, classId, classes, cache, onClose, onSent }) {
  const [list, setList] = useState(null),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(''),
    [classIds, setClassIds] = useState([classId]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(null),
    sending = useRef(false);
  useEffect(() => {
    let live = true;
    readHub(cache, `${user.user_id}:drafts:${page}`, () => api('assessments', undefined, { page }))
      .then((data) => {
        if (live) setList(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [page]);
  return (
    <Modal
      title="Giao bài kiểm tra"
      description="Chọn bài đã soạn và một hoặc nhiều lớp được quản lý. Bài đã gửi giữ nguyên nội dung."
      onClose={busy ? undefined : onClose}
    >
      <form
        className="account-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (sending.current || !selected || !classIds.length) return;
          sending.current = true;
          setBusy(true);
          setError('');
          try {
            if (!pending.current) {
              const data = await api('assessment', undefined, { assessmentId: selected });
              const exam = data.assessment;
              if (exam.status !== 'draft' || exam.can_manage === false)
                throw Error('Bài không còn là bản nháp được phép giao.');
              pending.current = {
                draft: {
                  ...exam.definition,
                  assessmentId: selected,
                  version: exam.version,
                  targets: { classIds, userIds: [] },
                  requestId: crypto.randomUUID(),
                },
                saved: null,
              };
            }
            if (!pending.current.saved) {
              const result = await api('assessment_save', pending.current.draft);
              pending.current.saved = result.data;
            }
            await api('assessment_publish', {
              assessmentId: selected,
              version: pending.current.saved.version,
            });
            onSent(classIds);
          } catch (e) {
            setError(e.message);
          } finally {
            sending.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !!pending.current}>
          <legend>Bài đã soạn</legend>
          {!list ? (
            <Loading />
          ) : (
            <>
              <label>
                Chọn bản nháp
                <select value={selected} required onChange={(e) => setSelected(e.target.value)}>
                  <option value="">Chọn bài kiểm tra</option>
                  {list.items
                    .filter((e) => e.status === 'draft' && e.can_manage !== false)
                    .map((e) => (
                      <option key={e.assessment_id} value={e.assessment_id}>
                        {e.title}
                      </option>
                    ))}
                </select>
              </label>
              {!list.items.some((e) => e.status === 'draft' && e.can_manage !== false) && (
                <p>Trang này chưa có bản nháp. Mở phần Kiểm tra để tạo bài hoặc xem trang khác.</p>
              )}
              <HubPages data={list} onPage={setPage} />
            </>
          )}
          <legend>Lớp nhận bài</legend>
          {classes
            .filter((c) => !c.archived_at)
            .map((c) => (
              <label key={c.class_id}>
                <input
                  type="checkbox"
                  checked={classIds.includes(c.class_id)}
                  onChange={(e) =>
                    setClassIds((ids) =>
                      e.target.checked
                        ? [...ids, c.class_id]
                        : ids.filter((id) => id !== c.class_id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <TipyButton type="submit" disabled={!selected || !classIds.length} loading={busy}>
          Gửi bài kiểm tra
        </TipyButton>
      </form>
    </Modal>
  );
}
