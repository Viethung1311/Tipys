import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Triangle,
  MessageCircle,
  Star,
  StarOff,
  Users,
  UserMinus,
} from 'lucide-react';
import { api } from '../../game/backend.js';
import Loading from '../../components/Loading.jsx';
import Avatar from './Avatar.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import ActionMenu from '../../components/ActionMenu.jsx';
import StudentActionDialog from '../admin/StudentActionDialog.jsx';
import Modal from '../../components/Modal.jsx';
import useDialogViewport from '../../hooks/useDialogViewport.js';
import { invalidateHub, readHub, shortName } from './hub-cache.js';
import './classroom-hub.css';
const Messages = lazy(() => import('./ClassMessages.jsx'));
const Assessments = lazy(() => import('../assessments/AssessmentsPage.jsx'));
const ClassQuestReport = lazy(() => import('./ClassQuestReport.jsx'));
const Notifications = lazy(() => import('./ClassNotifications.jsx'));
const tabs = [
  ['members', 'Thành viên', Users],
  ['notifications', 'Thông báo', Bell],
  ['tests', 'Kiểm tra', BookOpen],
  ['messages', 'Tin nhắn', MessageCircle],
];
export default function ClassroomPage({
  user,
  classes: availableClasses,
  cache,
  avatarOverride,
  onBack,
  initialTab = 'members',
  requestedAssessment,
  requestedPost,
  sound,
  blocked,
  onPlayingChange,
}) {
  const classes = availableClasses.filter((c) => !c.archived_at);
  const [classId, setClassId] = useState(
    () => new URLSearchParams(location.search).get('class') || classes[0]?.class_id || '',
  );
  const [tab, setTab] = useState(
    () => new URLSearchParams(location.search).get('tab') || initialTab,
  );
  const [page, setPage] = useState(1),
    [overview, setOverview] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0),
    [target, setTarget] = useState(null),
    [visited, setVisited] = useState(new Set()),
    [report, setReport] = useState(false),
    [examRequest, setExamRequest] = useState(requestedAssessment || null),
    [postRequest, setPostRequest] = useState(requestedPost || null),
    [testsRevision, setTestsRevision] = useState(0),
    [accessChecking, setAccessChecking] = useState(false),
    [messagesRevision, setMessagesRevision] = useState(0);
  const mounted = useRef(true),
    current = useRef(classId),
    dirty = useRef(false),
    accessFlight = useRef(false),
    previousTab = useRef(initialTab),
    pendingTop = useRef(false);
  current.current = classId;
  const prefix = `${user.user_id}:${classId}:`,
    style = useDialogViewport(true);
  const allowed = classes.some((c) => c.class_id === classId);
  const room = classes.find((c) => c.class_id === classId);
  const canManage = ['admin', 'teacher'].includes(user.role) && overview?.canManage;
  useEffect(() => {
    mounted.current = true;
    document.body.classList.add('classroom-active');
    return () => {
      mounted.current = false;
      document.body.classList.remove('classroom-active');
    };
  }, []);
  useEffect(() => {
    if (!allowed) {
      setClassId(classes[0]?.class_id || '');
      setOverview(null);
      setTarget(null);
    }
  }, [allowed, availableClasses]);
  useEffect(() => {
    if (requestedAssessment) {
      setExamRequest(requestedAssessment);
      setTab('tests');
      if (
        requestedAssessment.classId &&
        classes.some((c) => c.class_id === requestedAssessment.classId)
      ) {
        setClassId(requestedAssessment.classId);
        setPage(1);
      }
    }
  }, [requestedAssessment]);
  useEffect(() => {
    setPostRequest(requestedPost);
    if (requestedPost && classes.some((c) => c.class_id === requestedPost.classId)) {
      setClassId(requestedPost.classId);
      setTab('messages');
    }
  }, [requestedPost]);
  useEffect(() => {
    if (previousTab.current !== initialTab) {
      previousTab.current = initialTab;
      setTab(initialTab);
    }
  }, [initialTab]);
  useEffect(() => {
    if (tabs.some((t) => t[0] === tab)) setVisited((old) => new Set([...old, tab]));
    else setTab('members');
    if (tab === 'members' && pendingTop.current) {
      pendingTop.current = false;
      setRevision((n) => n + 1);
    }
  }, [tab]);
  useEffect(() => {
    if (!allowed) return;
    const params = new URLSearchParams({ class: classId, tab });
    history.replaceState(null, '', `/classroom?${params}`);
  }, [classId, tab, allowed]);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setError('');
    readHub(cache, `${prefix}members:${page}`, () =>
      api('classroom_hub', undefined, { classId, page }),
    )
      .then((data) => {
        if (live) {
          setOverview({
            ...data,
            receivedAt: cache.get(`${prefix}members:${page}`)?.receivedAt ?? performance.now(),
          });
          setAccessChecking(false);
          accessFlight.current = false;
        }
      })
      .catch((e) => {
        if (live) {
          setOverview(null);
          setError(e.message);
          setAccessChecking(false);
        }
      });
    return () => {
      live = false;
    };
  }, [classId, user.user_id, page, revision, allowed]);
  useEffect(() => {
    const refresh = ({ detail: change, type } = {}) => {
      if (type === 'tipy-class-access-changed') {
        if (accessFlight.current) return;
        accessFlight.current = true;
        setAccessChecking(true);
        setTarget(null);
        invalidateHub(cache, prefix);
      }
      if (change?.classIds && !change.classIds.includes(classId)) return;
      invalidateHub(cache, prefix + 'members:');
      if (change?.overview?.classroom.class_id === classId) {
        cache.set(prefix + 'members:1', {
          data: change.overview,
          time: Date.now(),
          receivedAt: performance.now(),
        });
        setOverview((old) =>
          old?.page === 1
            ? { ...change.overview, receivedAt: performance.now() }
            : old && old.classroom.class_id === classId
              ? {
                  ...old,
                  top: change.overview.top,
                  members: old.members.map((m) =>
                    m.user_id === change.userId ? { ...m, stars: change.stars } : m,
                  ),
                }
              : change.overview,
        );
        return;
      }
      setOverview((old) =>
        old && change?.userId && Number.isFinite(change.stars)
          ? {
              ...old,
              members: old.members.map((m) =>
                m.user_id === change.userId ? { ...m, stars: change.stars } : m,
              ),
            }
          : old,
      );
      setRevision((n) => n + 1);
    };
    window.addEventListener('tipy-points-changed', refresh);
    window.addEventListener('tipy-class-access-changed', refresh);
    const storage = (e) => {
      if (e.key === 'tipy-class-members-changed') {
        try {
          const update = JSON.parse(e.newValue);
          if (update.classId === classId) {
            invalidateHub(cache, prefix);
            refresh();
          }
        } catch {}
      }
    };
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('tipy-points-changed', refresh);
      window.removeEventListener('tipy-class-access-changed', refresh);
      window.removeEventListener('storage', storage);
    };
  }, [classId, prefix]);
  useEffect(() => {
    const updated = ({ detail }) => {
      if (detail.userId !== user.user_id) return;
      if (detail.added?.some((n) => n.kind === 'post' && n.payload.classId === classId)) {
        invalidateHub(cache, prefix + 'messages:');
        setMessagesRevision((n) => n + 1);
      }
      if (detail.added?.some((n) => n.kind === 'star_gift' && n.payload.classId === classId)) {
        invalidateHub(cache, prefix + 'members:');
        if (tab === 'members') setRevision((n) => n + 1);
        else pendingTop.current = true;
      }
    };
    window.addEventListener('tipy-notifications-updated', updated);
    return () => window.removeEventListener('tipy-notifications-updated', updated);
  }, [classId, user.user_id, tab]);
  useEffect(() => {
    if (!overview?.nextWeekAt) return;
    const delay =
      Date.parse(overview.nextWeekAt) -
      Date.parse(overview.serverNow) -
      Math.max(0, performance.now() - (overview.receivedAt ?? performance.now()));
    const timer = setTimeout(
      () => {
        invalidateHub(cache, prefix + 'members:');
        setRevision((n) => n + 1);
      },
      Math.max(1, Math.min(delay, 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [overview?.nextWeekAt, overview?.serverNow, classId]);
  const changeClass = (id) => {
    if (id === classId) return;
    if (dirty.current && !window.confirm('Bản đang soạn chưa gửi. Đổi lớp và bỏ bản nháp này?'))
      return;
    dirty.current = false;
    setClassId(id);
    setPage(1);
    setOverview(null);
    setVisited(new Set([tab]));
    setTarget(null);
    setReport(false);
    setExamRequest(null);
    setPostRequest(null);
    setNotice('');
  };
  const back = () => {
    if (tab !== 'members') {
      setTab('members');
      return;
    }
    if (dirty.current && !window.confirm('Bản đang soạn chưa gửi. Trở về và bỏ bản nháp này?'))
      return;
    onBack?.();
  };
  const data = overview?.classroom.class_id === classId && allowed ? overview : null;
  const nav = (overviewNav = false) => (
    <nav className={overviewNav ? 'hub-overview-nav' : 'hub-tabs'} aria-label="Các phần của lớp">
      {tabs
        .filter((t) => !overviewNav || t[0] !== 'members')
        .map(([key, label, Icon]) => (
          <TipyButton
            key={key}
            icon={Icon}
            emphasis={key === tab ? undefined : 'secondary'}
            aria-current={key === tab ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            <span>{label}</span>
          </TipyButton>
        ))}
    </nav>
  );
  return (
    <main className="classroom-hub" style={style} aria-label="Lớp học Zunimo">
      <header className="hub-toolbar">
        <TipyButton icon={ArrowLeft} emphasis="secondary" onClick={back}>
          Trở về
        </TipyButton>
        <h1>{room?.name || 'Lớp học'}</h1>
        <ActionMenu
          className="hub-class-picker"
          label={`Lớp: ${room?.name || 'Chọn lớp'}`}
          icon={Triangle}
          disabled={!classes.length}
          items={classes.map((c) => ({ label: c.name, onClick: () => changeClass(c.class_id) }))}
        />
      </header>
      {error && (
        <p role="alert" className="hub-status account-error">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>Thử lại</button>
        </p>
      )}
      {notice && (
        <p role="status" className="hub-status">
          {notice}
        </p>
      )}
      {!classes.length ? (
        <section className="hub-empty panel">
          <h2>Chưa có lớp học</h2>
          <p>
            {user.role === 'teacher'
              ? 'Bạn chưa được phân công lớp.'
              : 'Giáo viên sẽ thêm em vào lớp.'}
          </p>
          {initialTab === 'tests' && user.role === 'student' && (
            <Suspense fallback={<Loading />}>
              <Assessments
                user={user}
                classes={classes}
                requestedAssessment={examRequest}
                sound={sound}
                blocked={blocked}
                onPlayingChange={onPlayingChange}
              />
            </Suspense>
          )}
        </section>
      ) : !allowed || accessChecking ? (
        <Loading label="Đang kiểm tra quyền lớp…" />
      ) : error && !data ? null : (
        <div className={`hub-body ${tab === 'members' ? 'is-overview' : ''}`}>
          {tab !== 'members' && nav()}
          <section className="hub-overview" hidden={tab !== 'members'} aria-label="Tổng quan lớp">
            <section className="hub-members panel">
              <div className="hub-panel-heading">
                <h2>Thành viên</h2>
                <span>{data?.total ?? '…'} học sinh</span>
              </div>
              <div
                className="hub-scroll"
                role="region"
                tabIndex={0}
                aria-label="Danh sách thành viên"
              >
                {!data ? (
                  !error && <Loading label="Đang mở lớp…" />
                ) : (
                  <>
                    <ul className="hub-member-grid">
                      {data.members.map((member) => (
                        <li
                          key={member.user_id}
                          title={`${member.name}${member.username ? ' · ' + member.username : ''}`}
                        >
                          {canManage ? (
                            <ActionMenu
                              label="Tùy chọn"
                              description={`${member.name} · ${member.username}`}
                              header={
                                <>
                                  <Avatar value={member.avatar} name={member.name} />
                                  <strong>{member.name}</strong>
                                  <small>@{member.username}</small>
                                  <span>
                                    <Star size={18} /> {member.stars} sao
                                  </span>
                                </>
                              }
                              items={[
                                {
                                  label: 'Cộng sao',
                                  icon: Star,
                                  onClick: () =>
                                    setTarget({
                                      kind: 'gift',
                                      student: { ...member, full_name: member.name },
                                    }),
                                },
                                {
                                  label: 'Trừ sao',
                                  icon: StarOff,
                                  onClick: () =>
                                    setTarget({
                                      kind: 'deduct',
                                      student: { ...member, full_name: member.name },
                                    }),
                                },
                                {
                                  label: 'Loại',
                                  icon: UserMinus,
                                  danger: true,
                                  onClick: () => setTarget({ kind: 'remove', student: member }),
                                },
                              ]}
                            >
                              <Avatar value={member.avatar} name={member.name} />
                            </ActionMenu>
                          ) : (
                            <span aria-label={member.name}>
                              <Avatar
                                value={
                                  member.user_id === user.user_id
                                    ? avatarOverride || member.avatar
                                    : member.avatar
                                }
                                name={member.name}
                              />
                            </span>
                          )}
                          <b>{shortName(member.name)}</b>
                          {member.user_id === user.user_id && <small>Bạn</small>}
                        </li>
                      ))}
                    </ul>
                    {!data.members.length && <p className="hub-empty">Lớp chưa có học sinh.</p>}
                    <HubPages data={data} onPage={setPage} />
                    {canManage && (
                      <TipyButton
                        emphasis="secondary"
                        icon={BookOpen}
                        onClick={() => setReport(true)}
                      >
                        Tiến độ lớp
                      </TipyButton>
                    )}
                  </>
                )}
              </div>
            </section>
            <aside className="hub-aside">
              <section className="hub-podium panel" aria-labelledby="hub-top-title">
                <h2 id="hub-top-title">Top 3</h2>
                <p>Sao trong lớp tuần này</p>
                {data && <small>{weekRange(data.weekStart, data.weekEnd)} · giờ Việt Nam</small>}
                <div className="hub-podium-places">
                  {[3, 1, 2].map((rank) => {
                    const student = data?.top.find((s) => Number(s.rank) === rank);
                    return student ? (
                      <div key={rank} className={`hub-place rank-${rank}`} title={student.name}>
                        <Avatar value={{ animal: student.animal }} name={student.name} />
                        <b>{shortName(student.name)}</b>
                        <span>
                          <Star size={16} />
                          {student.stars}
                        </span>
                        <strong aria-label={`Hạng ${rank}`}>{rank}</strong>
                      </div>
                    ) : null;
                  })}
                </div>
                {data && !data.top.length && <p>Chưa có thành viên để xếp hạng.</p>}
              </section>
              {nav(true)}
            </aside>
          </section>
          {visited.has('messages') && (
            <section
              hidden={tab !== 'messages'}
              className="hub-content hub-scroll"
              tabIndex={0}
              aria-label="Tin nhắn của lớp"
            >
              <Suspense fallback={<Loading />}>
                <Messages
                  key={classId}
                  user={user}
                  classId={classId}
                  classes={classes}
                  cache={cache}
                  visible={tab === 'messages'}
                  refreshKey={messagesRevision}
                  onDirty={(value) => {
                    dirty.current = value;
                  }}
                  requestedPost={postRequest}
                  onTests={() => {
                    setTestsRevision((n) => n + 1);
                    setTab('tests');
                    setNotice('Đã gửi bài kiểm tra đến các lớp đã chọn.');
                  }}
                />
              </Suspense>
            </section>
          )}
          {visited.has('tests') && (
            <section
              hidden={tab !== 'tests'}
              className="hub-content hub-scroll"
              tabIndex={0}
              aria-label="Bài kiểm tra của lớp"
            >
              <Suspense fallback={<Loading />}>
                <Assessments
                  key={`${classId}:${testsRevision}`}
                  user={user}
                  classes={classes}
                  classId={classId}
                  cache={cache}
                  sound={sound}
                  blocked={blocked}
                  onPlayingChange={onPlayingChange}
                  requestedAssessment={examRequest}
                />
              </Suspense>
            </section>
          )}
          {visited.has('notifications') && (
            <section
              hidden={tab !== 'notifications'}
              className="hub-content hub-scroll"
              tabIndex={0}
              aria-label="Thông báo của lớp"
            >
              <Suspense fallback={<Loading />}>
                <Notifications
                  key={classId}
                  user={user}
                  classId={classId}
                  cache={cache}
                  active={tab === 'notifications'}
                  onView={(n) => {
                    if (n.kind === 'assessment') {
                      window.dispatchEvent(
                        new CustomEvent('tipy-open-assessment', { detail: n.assessment_id }),
                      );
                      setTab('tests');
                    } else if (n.kind === 'post') {
                      setPostRequest(n.payload);
                      setTab('messages');
                    }
                  }}
                />
              </Suspense>
            </section>
          )}
        </div>
      )}
      {report && (
        <Modal title="Tiến độ của lớp" description={room?.name} onClose={() => setReport(false)}>
          <Suspense fallback={<Loading />}>
            <ClassQuestReport classId={classId} />
          </Suspense>
        </Modal>
      )}
      {target &&
        (target.kind === 'remove' ? (
          <RemoveMember
            target={target.student}
            classId={classId}
            className={room?.name}
            onClose={() => setTarget(null)}
            onDone={(answer) => {
              if (!mounted.current || current.current !== answer.classId) return;
              invalidateHub(cache, prefix);
              setPage(1);
              setOverview(answer.overview);
              cache.set(prefix + 'members:1', { data: answer.overview, time: Date.now() });
              setTarget(null);
              setNotice('Đã loại học sinh khỏi lớp. Tài khoản và lịch sử vẫn được giữ.');
              try {
                localStorage.setItem(
                  'tipy-class-members-changed',
                  JSON.stringify({ classId, at: Date.now() }),
                );
              } catch {}
            }}
          />
        ) : (
          <StudentActionDialog
            {...target}
            compact
            classId={classId}
            classLabel={room?.name}
            onClose={() => setTarget(null)}
            onDone={(answer) => {
              if (!mounted.current) return;
              setNotice(
                `Đã ${target.kind === 'gift' ? 'cộng' : 'trừ'} ${answer.amount} sao cho ${target.student.full_name}.`,
              );
              setTarget(null);
            }}
          />
        ))}
    </main>
  );
}
export function HubPages({ data, onPage }) {
  return data.pages > 1 ? (
    <nav className="hub-pages" aria-label="Phân trang">
      <TipyButton
        emphasis="secondary"
        disabled={data.page <= 1}
        onClick={() => onPage(data.page - 1)}
      >
        Trước
      </TipyButton>
      <span>
        Trang {data.page}/{data.pages}
      </span>
      <TipyButton
        emphasis="secondary"
        disabled={data.page >= data.pages}
        onClick={() => onPage(data.page + 1)}
      >
        Sau
      </TipyButton>
    </nav>
  ) : null;
}
function weekRange(start, end) {
  const format = (value) =>
    new Date(value).toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
    });
  return `${format(start)} – ${format(Date.parse(end) - 86400000)}`;
}
function RemoveMember({ target, classId, className, onClose, onDone }) {
  const [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [requestId] = useState(() => crypto.randomUUID());
  const sending = useRef(false);
  return (
    <Modal
      title="Loại khỏi lớp?"
      description={`${target.name} (@${target.username}) · ${className}. Chỉ bỏ thành viên lớp này; giữ tài khoản, lịch sử và các lớp khác.`}
      onClose={busy ? undefined : onClose}
      className="hub-remove"
    >
      <Avatar value={target.avatar} name={target.name} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (confirm !== 'accept' || sending.current) return;
          sending.current = true;
          setBusy(true);
          setError('');
          try {
            const result = await api('class_remove_member', {
              classId,
              userId: target.user_id,
              requestId,
              confirm,
            });
            if (!result.data?.completed) throw Error('Chưa xác nhận được kết quả. Hãy thử lại.');
            onDone(result.data);
          } catch (e) {
            setError(e.message);
          } finally {
            sending.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          Nhập chính xác accept để loại
          <input
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <TipyButton
          type="submit"
          variant="danger"
          icon={UserMinus}
          loading={busy}
          disabled={confirm !== 'accept'}
        >
          Loại
        </TipyButton>
      </form>
    </Modal>
  );
}
