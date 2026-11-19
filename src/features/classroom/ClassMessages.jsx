import { useEffect, useRef, useState } from 'react';
import { Send, BookOpen } from 'lucide-react';
import { api } from '../../game/backend.js';
import { TEACHER_NAME } from '../../game/teacher.js';
import TipyButton from '../../components/TipyButton.jsx';
import Loading from '../../components/Loading.jsx';
import PostComposer from './PostComposer.jsx';
import Attachment from './Attachment.jsx';
import { HubPages } from './ClassroomPage.jsx';
import { invalidateHub, readHub } from './hub-cache.js';
import AssessmentSender from './ClassAssessmentSender.jsx';
export default function ClassMessages({
  user,
  classId,
  classes,
  cache,
  onDirty,
  requestedPost,
  onTests,
  visible = true,
  refreshKey = 0,
}) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [composer, setComposer] = useState(null),
    [sender, setSender] = useState(false),
    [busy, setBusy] = useState(false),
    [highlight, setHighlight] = useState(null);
  const active = useRef(true),
    sending = useRef(false);
  const prefix = `${user.user_id}:${classId}:messages:`,
    staff = ['admin', 'teacher'].includes(user.role);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setError('');
    setData(null);
    readHub(cache, prefix + page, () =>
      api('class_posts', undefined, { classId, offset: (page - 1) * 20 }),
    )
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [classId, page, revision, visible, refreshKey]);
  useEffect(() => {
    if (!requestedPost?.postId || !data) return;
    let live = true;
    const element = document.getElementById(`post-${requestedPost.postId}`);
    if (element) element.scrollIntoView({ block: 'nearest' });
    else
      readHub(cache, prefix + requestedPost.postId, () =>
        api('class_posts', undefined, { classId, postId: requestedPost.postId }),
      )
        .then((value) => {
          if (live) setHighlight(value.posts[0] || null);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [requestedPost, data]);
  useEffect(() => {
    if (highlight)
      document.getElementById(`post-${highlight.post_id}`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);
  const refresh = async () => {
    invalidateHub(cache, prefix);
    setPage(1);
    setRevision((n) => n + 1);
  };
  return (
    <>
      <div className="hub-compose-actions">
        <h2>Tin nhắn</h2>
        {staff && (
          <>
            <TipyButton
              icon={Send}
              onClick={() => setComposer((old) => !old)}
              aria-expanded={composer}
            >
              Gửi bài
            </TipyButton>
            <TipyButton icon={BookOpen} emphasis="secondary" onClick={() => setSender(true)}>
              Giao kiểm tra
            </TipyButton>
          </>
        )}
      </div>
      {error && (
        <p role="alert">
          {error}
          <button onClick={refresh}>Thử lại</button>
        </p>
      )}
      {composer !== null && (
        <div hidden={!composer}>
          <PostComposer
            classId={classId}
            authorName={user.role === 'admin' ? TEACHER_NAME : user.full_name}
            onDirty={onDirty}
            onPosted={refresh}
          />
        </div>
      )}
      {!data && !error ? (
        <Loading label="Đang tải tin nhắn…" />
      ) : data?.posts.length === 0 ? (
        <p>Chưa có tin nhắn trong lớp.</p>
      ) : (
        (highlight
          ? [highlight, ...data.posts.filter((p) => p.post_id !== highlight.post_id)]
          : data?.posts
        )?.map((post) => (
          <article id={`post-${post.post_id}`} className="panel class-post" key={post.post_id}>
            <small>
              {post.author?.role === 'teacher' ? post.author.full_name : TEACHER_NAME} ·{' '}
              {new Date(post.created_at).toLocaleString('vi-VN')}
            </small>
            <h3>{post.title}</h3>
            <p className="post-body">{post.body}</p>
            {post.link && (
              <a className="lesson-link" href={post.link} target="_blank" rel="noopener noreferrer">
                Mở link bài học
              </a>
            )}
            {post.class_attachments.map((file) => (
              <Attachment key={file.attachment_id} file={file} />
            ))}
            {(user.role === 'admin' ||
              (user.role === 'teacher' && post.author_id === user.user_id)) && (
              <TipyButton
                emphasis="secondary"
                loading={busy}
                onClick={async () => {
                  if (sending.current) return;
                  sending.current = true;
                  setBusy(true);
                  try {
                    await api('post_archive', { postId: post.post_id });
                    if (active.current) refresh();
                  } catch (e) {
                    if (active.current) setError(e.message);
                  } finally {
                    sending.current = false;
                    if (active.current) setBusy(false);
                  }
                }}
              >
                Gỡ bài
              </TipyButton>
            )}
          </article>
        ))
      )}
      {data && (
        <HubPages
          data={{ page, pages: page + (data.posts.length === 20 ? 1 : 0) }}
          onPage={setPage}
        />
      )}
      {sender && (
        <AssessmentSender
          user={user}
          classId={classId}
          classes={classes}
          cache={cache}
          onClose={() => setSender(false)}
          onSent={(ids) => {
            setSender(false);
            for (const id of ids) invalidateHub(cache, `${user.user_id}:${id}:tests:`);
            invalidateHub(cache, `${user.user_id}:drafts:`);
            onTests();
          }}
        />
      )}
    </>
  );
}
