import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import { TEACHER_NAME } from '../../game/teacher.js';
import Loading from '../../components/Loading.jsx';
import Reveal from '../../shared/Reveal.jsx';
import Avatar from './Avatar.jsx';
import Attachment from './Attachment.jsx';
import PostComposer from './PostComposer.jsx';
import ClassAchievements from './ClassAchievements.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { CircleHelp, BookOpen, Star, StarOff } from 'lucide-react';
import ActionMenu from '../../components/ActionMenu.jsx';
import StudentActionDialog from '../admin/StudentActionDialog.jsx';
import Modal from '../../components/Modal.jsx';
const ClassQuestReport = lazy(() => import('./ClassQuestReport.jsx'));
export default function ClassroomPage({ user, classes: availableClasses, cache, avatarOverride }) {
  const classes = availableClasses.filter((c) => !c.archived_at);
  const [guideOpen, setGuideOpen] = useState(false);
  const [starTarget, setStarTarget] = useState(null),
    [notice, setNotice] = useState('');
  const [classId, setClassId] = useState(() => classes[0]?.class_id || ''),
    [detail, setDetail] = useState(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [hasMore, setHasMore] = useState(false);
  const latestClassId = useRef(classId);
  latestClassId.current = classId;
  useEffect(() => {
    const changed = ({ detail: update }) => {
      if (!Number.isFinite(update?.stars)) return;
      cache.delete(user.user_id + ':' + classId);
      setDetail(
        (previous) =>
          previous && {
            ...previous,
            members: previous.members.map((member) =>
              member.user_id === update.userId ? { ...member, stars: update.stars } : member,
            ),
          },
      );
    };
    window.addEventListener('tipy-points-changed', changed);
    return () => window.removeEventListener('tipy-points-changed', changed);
  }, [classId, user.user_id, cache]);
  useEffect(() => {
    setStarTarget(null);
    setNotice('');
  }, [classId]);
  useEffect(() => {
    if (!classId) {
      setDetail(null);
      setBusy(false);
      return;
    }
    let live = true;
    const key = user.user_id + ':' + classId;
    // Recheck membership before displaying any cached class content.
    setDetail(null);
    setBusy(true);
    setError('');
    api('classroom', undefined, { classId })
      .then((data) => {
        if (live) {
          cache.set(key, { data, time: Date.now() });
          setDetail(data);
          setHasMore(data.posts.length === 20);
        }
      })
      .catch((e) => {
        if (live) {
          cache.delete(key);
          setError(e.message);
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [classId, user.user_id, cache]);
  const refresh = async () => {
    const requestedClass = classId;
    const data = await api('class_posts', undefined, { classId });
    if (latestClassId.current !== requestedClass) return;
    cache.delete(user.user_id + ':' + classId);
    setDetail((previous) => ({ ...previous, posts: data.posts }));
    setHasMore(data.posts.length === 20);
  };
  const run = async (task) => {
    setSaving(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setDetail(null);
      cache.delete(user.user_id + ':' + classId);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="classroom-page">
      <Reveal>
        <div className="page-title">
          <span className="eyebrow">GÓC LỚP HỌC Zunimo</span>
          <h1>
            Lớp học của mình<span>.</span>
          </h1>
          <p>Cùng học, cùng khám phá và nhận bài từ thầy cô.</p>
        </div>
      </Reveal>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy ? (
        <Loading label="Đang mở lớp học…" />
      ) : !classes.length ? (
        <section className="panel">
          <h2>Chưa có lớp học</h2>
          <p>Giáo viên sẽ thêm tài khoản của bạn vào lớp. Bạn vẫn có thể luyện gõ chữ nhé!</p>
        </section>
      ) : (
        <>
          <TipyButton emphasis="secondary" icon={CircleHelp} onClick={() => setGuideOpen(true)}>
            Hướng dẫn
          </TipyButton>
          <label className="class-select">
            Chọn lớp
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {detail && detail.classroom.class_id === classId && (
            <>
              <Reveal key={`roster-${classId}`}>
                <div className="classroom-layout">
                  <section className="panel classroom-board" aria-labelledby="class-roster-heading">
                    <div className="classroom-board-heading">
                      <div>
                        <span className="eyebrow">LỚP HỌC CỦA CHÚNG MÌNH</span>
                        <h2 id="class-roster-heading">{detail.classroom.name}</h2>
                      </div>
                      <span className="class-count">{detail.members.length} học sinh</span>
                    </div>
                    <ul className="class-desks" aria-label="Các học sinh trong lớp">
                      {detail.members.map((member, index) => (
                        <li
                          className={`student-desk ${member.user_id === user.user_id ? 'own-desk' : ''}`}
                          key={member.user_id}
                          title={member.name}
                        >
                          <span className="seat-number">{String(index + 1).padStart(2, '0')}</span>
                          {user.role === 'admin' && detail.canManage && member.username ? (
                            <ActionMenu
                              label="Thao tác sao"
                              description={member.name}
                              items={[
                                {
                                  label: 'Tặng sao',
                                  icon: Star,
                                  onClick: () =>
                                    setStarTarget({
                                      kind: 'gift',
                                      student: { ...member, full_name: member.name },
                                    }),
                                },
                                {
                                  label: 'Trừ sao',
                                  icon: StarOff,
                                  onClick: () =>
                                    setStarTarget({
                                      kind: 'deduct',
                                      student: { ...member, full_name: member.name },
                                    }),
                                },
                              ]}
                            >
                              <Avatar value={member.avatar} name={member.name} />
                            </ActionMenu>
                          ) : (
                            <Avatar
                              value={
                                member.user_id === user.user_id
                                  ? avatarOverride || member.avatar
                                  : member.avatar
                              }
                              name={member.name}
                            />
                          )}
                          <b>{member.name}</b>
                          {member.user_id === user.user_id && (
                            <span className="own-seat-label">Bạn</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {!detail.members.length && (
                      <p className="empty-desks">Giáo viên đang chuẩn bị chỗ ngồi cho lớp.</p>
                    )}
                  </section>
                  <ClassAchievements
                    classId={classId}
                    user={user}
                    avatarOverride={avatarOverride}
                  />
                </div>
              </Reveal>
              {user.role === 'admin' && (
                <Suspense fallback={<Loading label="Đang mở báo cáo…" />}>
                  <ClassQuestReport key={`quest-report-${classId}`} classId={classId} />
                </Suspense>
              )}
              {user.role === 'admin' && (
                <PostComposer key={`composer-${classId}`} classId={classId} onPosted={refresh} />
              )}
              <h2 className="class-feed-title">📚 Bảng tin & bài học</h2>
              {!detail.posts.length && (
                <section className="panel">
                  <p>Chưa có bài đăng. Bài của giáo viên sẽ xuất hiện ở đây.</p>
                </section>
              )}
              {detail.posts.map((post) => (
                <Reveal key={post.post_id}>
                  <article className="panel class-post">
                    <small>
                      👩‍🏫 {TEACHER_NAME} · {new Date(post.created_at).toLocaleString('vi-VN')}
                    </small>
                    <h2>{post.title}</h2>
                    <p className="post-body">{post.body}</p>
                    {post.link && (
                      <a
                        className="lesson-link"
                        href={post.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🔗 Mở link bài học ↗
                      </a>
                    )}
                    {post.class_attachments.map((file) => (
                      <Attachment key={file.attachment_id} file={file} />
                    ))}
                    {user.role === 'admin' && (
                      <button
                        className="text-button"
                        disabled={saving}
                        onClick={() =>
                          run(async () => {
                            await api('post_archive', { postId: post.post_id });
                            await refresh();
                          })
                        }
                      >
                        Gỡ bài khỏi bảng tin
                      </button>
                    )}
                  </article>
                </Reveal>
              ))}
              {hasMore && (
                <TipyButton
                  emphasis="secondary"
                  icon={BookOpen}
                  disabled={saving}
                  onClick={() =>
                    run(async () => {
                      cache.delete(user.user_id + ':' + classId);
                      const next = await api('class_posts', undefined, {
                        classId,
                        offset: detail.posts.length,
                      });
                      if (latestClassId.current !== classId) return;
                      setDetail((previous) => ({
                        ...previous,
                        posts: [...previous.posts, ...next.posts],
                      }));
                      setHasMore(next.posts.length === 20);
                    })
                  }
                >
                  Xem bài cũ hơn
                </TipyButton>
              )}
            </>
          )}
        </>
      )}
      {saving && <Loading label="Đang lưu thay đổi…" />}
      {starTarget && (
        <StudentActionDialog
          {...starTarget}
          classId={classId}
          onClose={() => setStarTarget(null)}
          onDone={(data) => {
            setNotice(
              `${starTarget.kind === 'gift' ? 'Đã tặng' : 'Đã trừ'} ${data.amount} sao · ${starTarget.student.full_name}. Tổng sao: ${data.stars}.`,
            );
            setStarTarget(null);
          }}
        />
      )}
      {guideOpen && (
        <Modal
          title="Hướng dẫn lớp học"
          description="Cùng học vui và nhận sao nhé!"
          onClose={() => setGuideOpen(false)}
        >
          <section>
            <h3>Sao của bạn</h3>
            <p>
              Hoàn thành mỗi bài để nhận từ 1 đến 3 sao. Đạt mức cao hơn sẽ nhận thêm phần sao còn
              thiếu. Mỗi bài nhận tối đa 3 sao; đủ sao vẫn được luyện lại. Nếu thầy cô cho làm lại
              từ đầu, bạn có thể nhận sao bài học lại. Bảng sao xếp theo tổng sao hiện tại, gồm sao
              bài học, sao thầy cô tặng và thưởng tuần đã nhận.
            </p>
          </section>
          <section>
            <h3>Chữ rơi</h3>
            <p>
              Bấm Thi đấu tuần để chơi mức Khó và tranh hạng cùng lớp. Mọi bạn dùng chung bộ chữ cái
              và tốc độ. Bạn đứng đầu nhận 5 sao khi tuần kết thúc.
            </p>
            <p>
              Cùng điểm thì bạn gõ chính xác hơn, rồi bạn đạt điểm sớm hơn được xếp trước. Tuần tính
              từ đầu thứ Hai đến hết Chủ nhật theo giờ Việt Nam. Hệ thống tự chốt và thưởng sau khi
              tuần kết thúc.
            </p>
          </section>
          <section>
            <h3>Sao của bạn</h3>
            <p>
              Gồm sao bài học, thưởng tuần và sao thầy cô tặng. Reset sao đưa tổng sao và sao xếp
              hạng về 0 nhưng giữ tiến độ và mức sao đã thưởng: bài đủ 3 sao không nhận lại, từ 2
              lên 3 sao chỉ thêm 1 sao. Sao mới vẫn cộng bình thường. Điểm thi đấu Chữ rơi · Khó
              không đổi.
            </p>
          </section>
        </Modal>
      )}
    </main>
  );
}
