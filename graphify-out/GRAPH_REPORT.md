# Graph Report - Web game Tipy  (2026-11-19)

## Corpus Check
- 227 files · ~165,340 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 32 file(s) not represented in the graph (top: .css 24, (none) 4, .woff2 3)

## Summary
- 1215 nodes · 3508 edges · 58 communities (44 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `545944c1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TipyButton
- classrooms.js
- KeyboardQuest.jsx
- App.jsx
- config.js
- check-assessments.mjs
- package.json
- TIPY backend · Supabase + Vercel
- ref_node_test
- Zunimo — chuẩn giao diện dùng chung
- public.tipy_student_reset
- Kết quả kiểm tra
- Hướng dẫn làm việc với Zunimo
- audio-ui.test.js
- jsdom
- ref_node_assert
- Zunimo — rà soát request và dữ liệu, 13/11/2026
- admin-students.test.js
- public.classes
- public.profiles
- ref_node_fs
- classroom-ui.test.js
- vercel.json
- .prettierrc.json
- public.assessment_assignments
- public.star_rewards
- public.tipy_publish_post
- tipy.js
- Third-party notices
- ApiError
- alphabet/README.md
- keyboard-quest.test.js
- public.student_notifications
- assessments.js
- assessments.js
- check-classroom-hub.mjs
- Cấu trúc và bảo trì TIPY STEM
- schema.sql
- check-teacher-roles.mjs
- notification-stream.test.js
- main.jsx
- scripts
- TIPY STEM · Vườn phím nhỏ
- devDependencies
- check-site-ui.mjs
- student-history.test.js
- public.tipy_students_page
- Ponytail
- @tailwindcss/vite
- vite
- loading-ui.test.js

## God Nodes (most connected - your core abstractions)
1. `public.profiles` - 98 edges
2. `TipyButton()` - 76 edges
3. `public.classes` - 68 edges
4. `public.class_members` - 67 edges
5. `api()` - 61 edges
6. `react` - 46 edges
7. `ApiError` - 43 edges
8. `lucide-react` - 39 edges
9. `public.star_rewards` - 35 edges
10. `Loading()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Bản đồ chọn thế giới` --references--> `isUnlocked()`  [INFERRED]
  BACKEND.md → src/features/keyboard-quest/curriculum.js
- `Ranh giới trách nhiệm` --references--> `useCompanion()`  [INFERRED]
  ARCHITECTURE.md → src/hooks/useCompanion.js
- `button()` --indirect_call--> `TipyButton()`  [INFERRED]
  tests/tipy-button.test.js → src/components/TipyButton.jsx
- `public.tipy_class_access()` --reads_from--> `public.classes`  [EXTRACTED]
  supabase/migrations/20261119101038_teacher_roles.sql → db/classrooms.sql
- `access()` --calls--> `ApiError`  [EXTRACTED]
  scripts/check-teacher-roles.mjs → server/errors.js

## Import Cycles
- None detected.

## Communities (58 total, 14 thin omitted)

### Community 0 - "TipyButton"
Cohesion: 0.05
Nodes (101): lucide-react, @radix-ui/react-dialog, react, Account(), AccountPoints(), ActionMenu(), AudioSettings(), assessmentSucceeded() (+93 more)

### Community 1 - "classrooms.js"
Cohesion: 0.12
Nodes (9): classMembersView(), createClassrooms(), safeLink(), validateFile(), ACCESSORIES, COLORS, FILE_TYPES, MAX_FILE_BYTES (+1 more)

### Community 2 - "KeyboardQuest.jsx"
Cohesion: 0.05
Nodes (48): @playwright/test, server, other, own, server, server, server, server (+40 more)

### Community 3 - "App.jsx"
Cohesion: 0.05
Nodes (45): App(), AssessmentsPage, ClassroomPage, KeyboardQuest, StudentNotifications, TypingGame, TypingSetup, characterFor() (+37 more)

### Community 4 - "config.js"
Cohesion: 0.07
Nodes (38): server, bubblePosition(), companionSay(), createSpeechGate(), DIALOGUE, PRIORITY, SPEECH_EVENT, CompanionSpeech() (+30 more)

### Community 5 - "check-assessments.mjs"
Cohesion: 0.07
Nodes (21): classes, server, server, classes, errors, exams, reads, server (+13 more)

### Community 6 - "package.json"
Cohesion: 0.18
Nodes (12): dependencies, lucide-react@^0.468.0, @radix-ui/react-dialog@^1.3.1, react@^19.2.0, react-dom@^19.2.0, @supabase/supabase-js@2.119.0, name, private (+4 more)

### Community 7 - "TIPY backend · Supabase + Vercel"
Cohesion: 0.08
Nodes (26): API cùng origin, Avatar ảnh dùng chung, Bài kiểm tra, Bản mở rộng sau MVP, Bản đồ chọn thế giới, Các biến máy chủ, Cấu trúc, Cập nhật lưu gọn và trang quản trị (+18 more)

### Community 8 - "ref_node_test"
Cohesion: 0.09
Nodes (4): @electric-sql/pglite, draft(), scope(), admin

### Community 9 - "Zunimo — chuẩn giao diện dùng chung"
Cohesion: 0.07
Nodes (29): 1. Định hướng, 2. Nút, 3. Màu và tương phản, 4. Chữ và icon, 5. Bố cục và nội dung, 6. Token và component, 7. Cổng kiểm tra, API nút (+21 more)

### Community 10 - "public.tipy_student_reset"
Cohesion: 0.10
Nodes (32): public.tipy_class_star_board(), public.student_avatars, active_plays_game, player_game_stats_game, public.active_plays, public.player_game_stats, public.tipy_begin_play(), public.tipy_save_play() (+24 more)

### Community 11 - "Kết quả kiểm tra"
Cohesion: 0.11
Nodes (17): Cập nhật database và backend, Cập nhật typing / admin riêng / lưu kết quả gọn, Cập nhật âm thanh, Giới hạn xác minh, Kiểm thử chuyển lớp, Kiểm tra sau triển khai, Kết quả kiểm tra, Loader phím vàng và hiệu ứng bảng top (+9 more)

### Community 12 - "Hướng dẫn làm việc với Zunimo"
Cohesion: 0.12
Nodes (16): 1. Định hướng chung, 2. Nút bấm, 3. Màu sắc, 4. Chữ và biểu tượng, 5. Bố cục và phản hồi, 6. Triển khai thống nhất, 7. Kiểm tra trước khi hoàn thành, Graphify — khi cần hiểu nhiều file (+8 more)

### Community 13 - "audio-ui.test.js"
Cohesion: 0.19
Nodes (5): createGain(), createOscillator(), Parameter, sleep(), until()

### Community 14 - "jsdom"
Cohesion: 0.12
Nodes (12): jsdom, sleep(), until(), sleep(), until(), sleep(), until(), setup() (+4 more)

### Community 15 - "ref_node_assert"
Cohesion: 0.13
Nodes (7): server, db, newSQL, sleep(), until(), sleep(), until()

### Community 16 - "Zunimo — rà soát request và dữ liệu, 13/11/2026"
Cohesion: 0.22
Nodes (8): Các đường dữ liệu và lý do request còn lại, File/form đã sửa, Kiểm tra và phần chưa đo, Kết quả đo, Migration và lịch định kỳ, Phạm vi và phương pháp, Truy vấn kết quả giáo viên, Zunimo — rà soát request và dữ liệu, 13/11/2026

### Community 18 - "public.classes"
Cohesion: 0.11
Nodes (33): class_attachments_owner, class_members_account, class_posts_owner, classes_owner, notification_class_post, notification_member_posts, public.class_member_removals, public.tipy_assessment() (+25 more)

### Community 19 - "public.profiles"
Cohesion: 0.08
Nodes (29): public.profiles, public.tipy_class_member_balances(), public.tipy_star_class_scope(), class_teachers_teacher, public.class_teachers, public.tipy_archive_post(), public.tipy_assessment_results(), public.tipy_class_member_balances() (+21 more)

### Community 20 - "ref_node_fs"
Cohesion: 0.14
Nodes (9): measurements, server, hubFixture(), notificationMigration, notificationsFixture(), balanceMigration, id(), starFixture() (+1 more)

### Community 21 - "classroom-ui.test.js"
Cohesion: 0.40
Nodes (5): child, classroom, detail, sleep(), until()

### Community 22 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, regions, rewrites

### Community 23 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, singleQuote, tabWidth, trailingComma

### Community 24 - "public.assessment_assignments"
Cohesion: 0.11
Nodes (31): public.tipy_assessment_best(), public.tipy_assessment_results(), assessment_class_targets_class, public.assessment_class_targets, public.tipy_assessment(), public.tipy_assessment_access(), public.tipy_sync_assessment_assignments(), assessment_attempts_due (+23 more)

### Community 25 - "public.star_rewards"
Cohesion: 0.10
Nodes (25): public.tipy_class_star_gift(), public.tipy_class_week_stars(), public.tipy_star_select_class(), star_rewards_class_week, student_actions_class_week, public.star_rewards, public.student_admin_actions, public.tipy_class_star_board() (+17 more)

### Community 26 - "public.tipy_publish_post"
Cohesion: 0.16
Nodes (9): public.class_deletions, public.tipy_ack_class_files(), public.tipy_publish_post(), public.tipy_class_notifications(), public.class_attachments, public.tipy_publish_post(), public.tipy_notifications_present(), public.tipy_publish_post() (+1 more)

### Community 27 - "tipy.js"
Cohesion: 0.10
Nodes (19): createNotificationEvents(), maxDuration, createHandler(), readCookies(), setSession(), backend, bus, calls (+11 more)

### Community 28 - "Third-party notices"
Cohesion: 0.50
Nodes (3): Loading animation, Nunito, Third-party notices

### Community 29 - "ApiError"
Cohesion: 0.37
Nodes (9): ApiError, requireAdmin(), createIdentity(), credential(), emailFor(), username(), createNotifications(), student() (+1 more)

### Community 33 - "keyboard-quest.test.js"
Cohesion: 0.20
Nodes (14): fail(), createKeyboardQuest(), questRows(), questStart(), validateQuestFinish(), lessonForStage(), createAnswers(), errorKind() (+6 more)

### Community 34 - "public.student_notifications"
Cohesion: 0.20
Nodes (13): public.tipy_notifications_list(), public.tipy_notifications_present(), notification_assessment_published, notification_assignment, notification_class_member, notification_gift, public.student_notifications, public.tipy_notification_event() (+5 more)

### Community 35 - "assessments.js"
Cohesion: 0.20
Nodes (7): assessmentResult(), assessmentSnapshot(), createAssessments(), distinct(), invalid(), text(), uuid()

### Community 36 - "assessments.js"
Cohesion: 0.26
Nodes (5): validateLevels(), validateProgress(), createGames(), SUPPORTED_KEYS, resultRows()

### Community 37 - "check-classroom-hub.mjs"
Cohesion: 0.14
Nodes (9): backend, calls, errors, handler, handlerRequest(), metrics, rooms, server (+1 more)

### Community 38 - "Cấu trúc và bảo trì TIPY STEM"
Cohesion: 0.15
Nodes (13): Ba vai trò và phạm vi giáo viên, Chọn thành viên theo lô, Cấu trúc và bảo trì TIPY STEM, Hiệu năng lớp học, Layout, chuyển động và ảnh Scratch, Mô hình dữ liệu, PlaySurface và kết quả, Quy trình sửa đổi (+5 more)

### Community 39 - "schema.sql"
Cohesion: 0.24
Nodes (8): play_history_game_user, play_history_user_time, profiles_student_active, public.play_history, tipy_new_user, tipy_private.auth_limits, tipy_private.is_admin(), tipy_private.new_profile()

### Community 40 - "check-teacher-roles.mjs"
Cohesion: 0.09
Nodes (11): measurements, server, access(), backend, calls, errors, handler, server (+3 more)

### Community 43 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, format, format:check, graphify, pretest, preview (+1 more)

### Community 44 - "TIPY STEM · Vườn phím nhỏ"
Cohesion: 0.22
Nodes (9): Chạy dự án, Cấu trúc, Kiểm tra và build, Luật chơi, Portal và lớp học, TIPY STEM · Vườn phím nhỏ, Trang chủ TIPY STEM Cẩm Lệ, Triển khai (+1 more)

### Community 45 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @electric-sql/pglite@0.5.15, jsdom@^29.1.1, @playwright/test@^1.56.0, prettier@3.6.2, tailwindcss@^4.1.0, prettier, tailwindcss

### Community 46 - "check-site-ui.mjs"
Cohesion: 0.29
Nodes (5): admin, games, server, student, students

### Community 49 - "Ponytail"
Cohesion: 0.40
Nodes (4): Before you write, Levels, Ponytail, The smallest complete change

### Community 50 - "@tailwindcss/vite"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.1.0, @vitejs/plugin-react@^5.1.0, @tailwindcss/vite, @vitejs/plugin-react

### Community 51 - "vite"
Cohesion: 0.50
Nodes (3): vite@^7.2.0, vite, directory

## Knowledge Gaps
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isUnlocked()` connect `KeyboardQuest.jsx` to `keyboard-quest.test.js`, `TIPY backend · Supabase + Vercel`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `TipyButton` be split into smaller, more focused modules?**
  _Cohesion score 0.05450310559006211 - nodes in this community are weakly interconnected._
- **Why does `react` connect `TipyButton` to `KeyboardQuest.jsx`, `App.jsx`, `config.js`, `package.json`, `main.jsx`, `jsdom`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `classrooms.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11666666666666667 - nodes in this community are weakly interconnected._
- **Why does `TIPY backend · Supabase + Vercel` connect `TIPY backend · Supabase + Vercel` to `ARCHITECTURE.md`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `KeyboardQuest.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05220883534136546 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052782558806655194 - nodes in this community are weakly interconnected._