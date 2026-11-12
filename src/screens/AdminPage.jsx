import { useEffect, useState } from 'react';
import { api } from '../game/backend.js';
import { LEVELS } from '../game/config.js';
import { practiceTime } from '../game/results.js';
import Loading from '../components/Loading.jsx';
import AdminClasses from '../features/classroom/AdminClasses.jsx';
import StudentHistory from '../features/admin/StudentHistory.jsx';
import StudentsTable from '../features/admin/StudentsTable.jsx';
import TipyButton from '../components/TipyButton.jsx';
import { LogIn, LogOut, Save } from 'lucide-react';
import AccountPoints from '../components/AccountPoints.jsx';
import Companion from '../components/Companion.jsx';
import useCompanion from '../hooks/useCompanion.js';
const fields = [
  ['fall', 'Thời gian rơi ban đầu (giây)', 1, 30, 0.1],
  ['minFall', 'Thời gian rơi nhanh nhất (giây)', 1, 30, 0.1],
  ['spawn', 'Khoảng xuất hiện ban đầu (giây)', 0.2, 15, 0.05],
  ['minSpawn', 'Khoảng xuất hiện ngắn nhất (giây)', 0.2, 15, 0.05],
  ['max', 'Số chữ tối đa cùng lúc', 1, 12, 1],
];
export default function AdminPage() {
  const [companionAvatar, setCompanionAvatar] = useState(null);
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [configured, setConfigured] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [companion, changeCompanion] = useCompanion(user?.user_id);
  const [tab, setTab] = useState('students'),
    [students, setStudents] = useState([]),
    [summary, setSummary] = useState({ students: 0, seconds: 0, plays: 0 }),
    [historyStudentId, setHistoryStudentId] = useState(''),
    [classes, setClasses] = useState([]),
    [games, setGames] = useState([]),
    [game, setGame] = useState(null),
    [levels, setLevels] = useState(LEVELS);
  const selectGame = (game) => {
    setGame(game);
    setLevels(game.config?.levels || LEVELS);
  };
  const load = async () => {
    const data = await api('bootstrap');
    setConfigured(data.configured);
    setUser(data.user);
    if (data.user?.role === 'admin') {
      setGames(data.games);
      if (data.games.length) selectGame(data.games[0]);
      setClasses(data.classes || []);
      const [pageData, avatarData] = await Promise.all([
        api('students_page'),
        api('avatar').catch(() => null),
      ]);
      setCompanionAvatar({ userId: data.user.user_id, value: avatarData?.avatar });
      setStudents(pageData.students);
      setSummary(pageData.summary);
    }
    setLoading(false);
  };
  useEffect(() => {
    load().catch((error) => {
      setError(error.message);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (tab !== 'results' || user?.role !== 'admin') return;
    let current = true;
    api('students')
      .then(({ students: rows }) => {
        if (current)
          setStudents((previous) => [
            ...rows,
            ...previous.filter(
              (s) =>
                s.user_id === historyStudentId && !rows.some((row) => row.user_id === s.user_id),
            ),
          ]);
      })
      .catch((error) => {
        if (current) setError(error.message);
      });
    return () => {
      current = false;
    };
  }, [tab, user?.user_id]);
  const run = async (action) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  // Patch only the affected students after a successful bulk write; no bootstrap/history reload.
  const patchMembers = ({ classId, className, userIds, active }) => {
    const changed = new Set(userIds);
    setStudents((previous) =>
      previous.map((student) => {
        if (!changed.has(student.user_id)) return student;
        const memberships = (student.class_members || []).filter(
          (m) => m.class_id !== classId && m.classes.class_id !== classId,
        );
        if (active)
          memberships.push({
            is_active: true,
            classes: { class_id: classId, name: className, archived_at: null },
          });
        return { ...student, class_members: memberships };
      }),
    );
  };
  const login = (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    run(async () => {
      await api('login', form);
      await load();
    });
  };
  const save = () =>
    run(async () => {
      await api('save_game', {
        gameCode: game.game_code,
        name: game.game_name,
        engineCode: game.engine_code,
        description: game.description,
        active: game.is_active,
        config: { ...game.config, levels },
      });
      setNotice('Đã lưu. Cấu hình có hiệu lực ở lượt chơi mới.');
      const data = await api('bootstrap');
      setGames(data.games);
    });
  return (
    <div className="admin-shell">
      {user?.role === 'admin' &&
        companionAvatar?.userId === user.user_id &&
        companionAvatar.value &&
        companion.visible && (
          <Companion
            key={user.user_id}
            avatar={companionAvatar.value}
            preferences={companion}
            onPosition={changeCompanion}
          />
        )}
      <header className="admin-header">
        <a href="/" className="brand">
          Zunimo
        </a>
        <span>TRANG QUẢN TRỊ</span>
        <AccountPoints key={user?.user_id || 'guest'} user={user} />
        <a href="/">← Về trò chơi</a>
      </header>
      <main className="admin-main">
        {loading ? (
          <Loading label="Đang tải trang quản trị…" />
        ) : user?.role !== 'admin' ? (
          <section className="panel admin-login">
            <h1>Đăng nhập quản trị</h1>
            <p>
              Chỉ tài khoản giáo viên quản trị mới truy cập dữ liệu học sinh và cấu hình trò chơi.
            </p>
            {user ? (
              <>
                <p>Tài khoản hiện tại không có quyền quản trị.</p>
                <TipyButton
                  emphasis="secondary"
                  icon={LogOut}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api('logout', {});
                      await load();
                    })
                  }
                >
                  Đổi tài khoản
                </TipyButton>
              </>
            ) : (
              <form className="account-form" onSubmit={login}>
                <label>
                  Tên đăng nhập
                  <input name="username" autoComplete="username" required defaultValue="admin" />
                </label>
                <label>
                  Mật khẩu
                  <input name="password" type="password" autoComplete="current-password" required />
                </label>
                <TipyButton type="submit" icon={LogIn} disabled={busy || !configured}>
                  {busy ? 'Đang đăng nhập…' : 'Đăng nhập admin'}
                </TipyButton>
              </form>
            )}
          </section>
        ) : (
          <>
            <div className="admin-title">
              <div>
                <span className="eyebrow">GÓC GIÁO VIÊN</span>
                <h1>Quản lý lớp học & trò chơi</h1>
                <p>Thời gian luyện là thời gian thực chơi, không tính đếm ngược và tạm dừng.</p>
              </div>
              <TipyButton
                emphasis="secondary"
                icon={LogOut}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api('logout', {});
                    setUser(null);
                  })
                }
              >
                Đăng xuất
              </TipyButton>
            </div>
            <div className="admin-metrics">
              <div>
                <small>Học sinh</small>
                <strong>{summary.students}</strong>
              </div>
              <div>
                <small>Tổng thời gian luyện</small>
                <strong>{practiceTime(summary.seconds)}</strong>
              </div>
              <div>
                <small>Tổng lượt luyện</small>
                <strong>{summary.plays}</strong>
              </div>
            </div>
            <nav className="admin-tabs" aria-label="Quản trị">
              {[
                ['classes', 'Lớp học'],
                ['students', 'Học sinh & thời gian'],
                ['results', 'Lịch sử chơi'],
                ['games', 'Tốc độ & độ khó'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={tab === value ? 'active' : ''}
                  aria-current={tab === value ? 'page' : undefined}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
              <button disabled={busy} onClick={() => run(load)}>
                Làm mới
              </button>
            </nav>
            {tab === 'classes' && (
              <AdminClasses
                initialClasses={classes}
                onChanged={load}
                onMembersChanged={patchMembers}
              />
            )}
            {tab === 'students' && (
              <StudentsTable
                classes={classes}
                onChanged={load}
                onResults={(student) => {
                  setStudents((previous) => [
                    ...previous.filter((s) => s.user_id !== student.user_id),
                    student,
                  ]);
                  setHistoryStudentId(student.user_id);
                  setTab('results');
                }}
              />
            )}
            {tab === 'results' && (
              <StudentHistory
                students={students}
                studentId={historyStudentId}
                onStudentChange={setHistoryStudentId}
              />
            )}
            {tab === 'games' && (
              <section className="panel">
                <h2>Cấu hình trò chơi</h2>
                <div className="account-form">
                  <label>
                    Chọn game
                    <select
                      value={game?.game_id || ''}
                      onChange={(event) =>
                        selectGame(games.find((g) => g.game_id === event.target.value))
                      }
                    >
                      {games.map((game) => (
                        <option key={game.game_id} value={game.game_id}>
                          {game.game_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {game && (
                  <>
                    <div className="account-form">
                      <label>
                        Tên game
                        <input
                          value={game.game_name}
                          onChange={(e) => setGame({ ...game, game_name: e.target.value })}
                        />
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={game.is_active}
                          onChange={(e) => setGame({ ...game, is_active: e.target.checked })}
                        />
                        Mở trò chơi cho học sinh
                      </label>
                    </div>
                    {game.engine_code === 'falling_letters' ? (
                      <>
                        <p className="admin-rule">
                          Luật typing: hết 3 mạng hoặc bấm sai lần thứ 6 thì kết thúc. Mỗi 500 điểm:
                          thời gian rơi giảm 0,5 giây, khoảng xuất hiện giảm 0,1 giây, đến giới hạn
                          đã đặt.
                        </p>
                        <div className="speed-grid">
                          {Object.entries(LEVELS).map(([id, level]) => (
                            <fieldset key={id}>
                              <legend>
                                {level.icon} {level.name}
                              </legend>
                              {fields.map(([key, label, min, max, step]) => (
                                <label key={key}>
                                  {label}
                                  <input
                                    type="number"
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={levels[id]?.[key] ?? ''}
                                    onChange={(e) =>
                                      setLevels({
                                        ...levels,
                                        [id]: { ...levels[id], [key]: Number(e.target.value) },
                                      })
                                    }
                                  />
                                </label>
                              ))}
                            </fieldset>
                          ))}
                        </div>
                        <p className="muted">
                          Số giây nhỏ hơn = nhanh hơn. Các mức nhanh nhất không được lớn hơn mức ban
                          đầu.
                        </p>
                      </>
                    ) : (
                      <p>Cấu hình riêng của game này được giữ nguyên.</p>
                    )}
                    <TipyButton icon={Save} disabled={busy} onClick={save}>
                      Lưu cấu hình
                    </TipyButton>
                  </>
                )}
              </section>
            )}
          </>
        )}
        {busy && <Loading label="Đang xử lý…" />}
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="admin-success" role="status">
            {notice}
          </p>
        )}
      </main>
    </div>
  );
}
