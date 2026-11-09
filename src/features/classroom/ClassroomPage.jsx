import { useEffect, useRef, useState } from 'react';
import { api } from '../../game/backend.js';
import Loading from '../../components/Loading.jsx';
import Reveal from '../../shared/Reveal.jsx';
import Avatar from './Avatar.jsx';
import Attachment from './Attachment.jsx';
import PostComposer from './PostComposer.jsx';
import ClassAchievements from './ClassAchievements.jsx';
export default function ClassroomPage({ user, onMembershipChange, avatarOverride }) {
  const [classes, setClasses] = useState([]),
    [classId, setClassId] = useState(''),
    [detail, setDetail] = useState(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [hasMore, setHasMore] = useState(false);
  const latestClassId = useRef(classId);
  latestClassId.current = classId;
  useEffect(() => {
    let live = true;
    setBusy(true);
    api('classes')
      .then((data) => {
        if (!live) return;
        const list = data.classes.filter((c) => !c.archived_at);
        setClasses(list);
        setClassId(list[0]?.class_id || '');
        onMembershipChange?.(list);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [user.user_id]);
  useEffect(() => {
    if (!classId) {
      setDetail(null);
      return;
    }
    let live = true;
    setDetail(null);
    setBusy(true);
    setError('');
    api('classroom', undefined, { classId })
      .then((data) => {
        if (live) {
          setDetail(data);
          setHasMore(data.posts.length === 20);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [classId, user.user_id]);
  const refresh = async () => {
    const requestedClass = classId;
    const data = await api('classroom', undefined, { classId });
    if (latestClassId.current !== requestedClass) return;
    setDetail(data);
    setHasMore(data.posts.length === 20);
  };
  const run = async (task) => {
    setSaving(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="classroom-page">
      <Reveal>
        <div className="page-title">
          <span className="eyebrow">GÓC LỚP HỌC TIPY</span>
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
      {busy ? (
        <Loading label="Đang mở lớp học…" />
      ) : !classes.length ? (
        <section className="panel">
          <h2>Chưa có lớp học</h2>
          <p>Giáo viên sẽ thêm tài khoản của bạn vào lớp. Bạn vẫn có thể luyện gõ chữ nhé!</p>
        </section>
      ) : (
        <>
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
          {detail && (
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
                          <Avatar
                            value={
                              member.user_id === user.user_id
                                ? avatarOverride || member.avatar
                                : member.avatar
                            }
                            name={member.name}
                          />
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
                    rows={detail.achievements}
                    user={user}
                    avatarOverride={avatarOverride}
                  />
                </div>
              </Reveal>
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
                      👩‍🏫 Giáo viên TIPY · {new Date(post.created_at).toLocaleString('vi-VN')}
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
                <button
                  className="secondary"
                  disabled={saving}
                  onClick={() =>
                    run(async () => {
                      const next = await api('classroom', undefined, {
                        classId,
                        offset: detail.posts.length,
                      });
                      if (latestClassId.current !== classId) return;
                      setDetail({ ...detail, posts: [...detail.posts, ...next.posts] });
                      setHasMore(next.posts.length === 20);
                    })
                  }
                >
                  Xem bài cũ hơn
                </button>
              )}
            </>
          )}
        </>
      )}
      {saving && <Loading label="Đang lưu thay đổi…" />}
    </main>
  );
}
