# Graph Report - Web game Tipy  (2026-11-20)

## Corpus Check
- 231 files · ~163,164 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 32 file(s) not represented in the graph (top: .css 24, (none) 4, .woff2 3)

## Summary
- 1230 nodes · 3545 edges · 62 communities (47 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70451dda`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TipyButton
- performance.test.js
- @playwright/test
- GameAudio
- scripts
- check-assessments.mjs
- package.json
- TIPY backend · Supabase + Vercel
- ref_node_assert
- Zunimo — chuẩn giao diện dùng chung
- public.tipy_student_reset
- Kết quả kiểm tra
- Hướng dẫn làm việc với Zunimo
- audio-ui.test.js
- jsdom
- ApiError
- Zunimo — rà soát request và dữ liệu, 13/11/2026
- App.jsx
- classroom_hub.sql
- public.profiles
- tipy.js
- keyboard-quest.test.js
- vercel.json
- .prettierrc.json
- public.assessment_assignments
- public.star_rewards
- public.tipy_publish_post
- ApiError
- Third-party notices
- ref_node_fs
- alphabet/README.md
- Cấu trúc và bảo trì TIPY STEM
- devDependencies
- public.student_notifications
- games.js
- ref_node_fs
- check-classroom-hub.mjs
- @tailwindcss/vite
- schema.sql
- public.tipy_assessment
- notification-stream.test.js
- main.jsx
- vite
- assessments.js
- admin-students.test.js
- KeyboardQuest.jsx
- assessment-class-access.test.js
- public.tipy_students_page
- Ponytail
- LetterTarget.jsx
- classroom-ui.test.js
- check-teacher-roles.mjs
- public.tipy_assessment
- dialog-viewport.test.js
- student-history.test.js
- keyboard-quest-ui.test.js

## God Nodes (most connected - your core abstractions)
1. `public.profiles` - 102 edges
2. `TipyButton()` - 70 edges
3. `public.classes` - 68 edges
4. `public.class_members` - 67 edges
5. `api()` - 61 edges
6. `react` - 47 edges
7. `ApiError` - 43 edges
8. `lucide-react` - 39 edges
9. `public.star_rewards` - 35 edges
10. `Loading()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `Bản đồ chọn thế giới` --references--> `isUnlocked()`  [INFERRED]
  BACKEND.md → src/features/keyboard-quest/curriculum.js
- `Ranh giới trách nhiệm` --references--> `useCompanion()`  [INFERRED]
  ARCHITECTURE.md → src/hooks/useCompanion.js
- `button()` --indirect_call--> `TipyButton()`  [INFERRED]
  tests/tipy-button.test.js → src/components/TipyButton.jsx
- `access()` --calls--> `ApiError`  [EXTRACTED]
  scripts/check-teacher-roles.mjs → server/errors.js
- `public.tipy_class_access()` --reads_from--> `public.classes`  [EXTRACTED]
  supabase/migrations/20261119101038_teacher_roles.sql → db/classrooms.sql

## Import Cycles
- None detected.

## Communities (62 total, 15 thin omitted)

### Community 0 - "TipyButton"
Cohesion: 0.05
Nodes (99): lucide-react, @radix-ui/react-dialog, react, Account(), AccountPoints(), ActionMenu(), AudioSettings(), assessmentSucceeded() (+91 more)

### Community 2 - "@playwright/test"
Cohesion: 0.10
Nodes (17): @playwright/test, server, other, own, server, server, server, classes (+9 more)

### Community 3 - "GameAudio"
Cohesion: 0.14
Nodes (8): AUDIO_DEFAULTS, GameAudio, normalizeAudio(), SOUNDS, tone(), FakeContext, Parameter, setup()

### Community 4 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, format, format:check, graphify, pretest, preview (+1 more)

### Community 5 - "check-assessments.mjs"
Cohesion: 0.10
Nodes (19): classes, server, admin, games, server, student, students, classroom (+11 more)

### Community 6 - "package.json"
Cohesion: 0.18
Nodes (12): dependencies, lucide-react@^0.468.0, @radix-ui/react-dialog@^1.3.1, react@^19.2.0, react-dom@^19.2.0, @supabase/supabase-js@2.119.0, name, private (+4 more)

### Community 7 - "TIPY backend · Supabase + Vercel"
Cohesion: 0.05
Nodes (35): API cùng origin, Avatar ảnh dùng chung, Bài kiểm tra, Bản mở rộng sau MVP, Bản đồ chọn thế giới, Các biến máy chủ, Cấu trúc, Cập nhật lưu gọn và trang quản trị (+27 more)

### Community 8 - "ref_node_assert"
Cohesion: 0.10
Nodes (4): @electric-sql/pglite, db, newSQL, admin

### Community 9 - "Zunimo — chuẩn giao diện dùng chung"
Cohesion: 0.09
Nodes (21): 1. Nguồn chuẩn và mức xác minh, 2. Định hướng, 3. Màu sắc, 4. Chữ và biểu tượng, 5. Khung, khoảng cách và responsive, 6.1. Tương tác chung, 6.2. Hành vi từng khu vực, 6. Component và trạng thái (+13 more)

### Community 10 - "public.tipy_student_reset"
Cohesion: 0.10
Nodes (31): public.tipy_class_star_board(), public.student_avatars, active_plays_game, player_game_stats_game, public.active_plays, public.player_game_stats, public.tipy_begin_play(), public.tipy_save_play() (+23 more)

### Community 11 - "Kết quả kiểm tra"
Cohesion: 0.11
Nodes (17): Cập nhật database và backend, Cập nhật typing / admin riêng / lưu kết quả gọn, Cập nhật âm thanh, Giới hạn xác minh, Kiểm thử chuyển lớp, Kiểm tra sau triển khai, Kết quả kiểm tra, Loader phím vàng và hiệu ứng bảng top (+9 more)

### Community 12 - "Hướng dẫn làm việc với Zunimo"
Cohesion: 0.22
Nodes (8): Dữ liệu và phân quyền phải giữ, Graphify — khi cần hiểu nhiều file, Hiệu năng và trạng thái, Hướng dẫn làm việc với Zunimo, Kiểm tra và bàn giao, Nguồn chuẩn và cách làm, Ponytail — mặc định full, Tự chọn công cụ

### Community 13 - "audio-ui.test.js"
Cohesion: 0.19
Nodes (5): createGain(), createOscillator(), Parameter, sleep(), until()

### Community 14 - "jsdom"
Cohesion: 0.14
Nodes (11): jsdom, sleep(), until(), sleep(), until(), sleep(), until(), sleep() (+3 more)

### Community 15 - "ApiError"
Cohesion: 0.26
Nodes (12): fail(), requireAdmin(), requireEducator(), createClassrooms(), uuid(), createNotifications(), createStars(), createStudents() (+4 more)

### Community 16 - "Zunimo — rà soát request và dữ liệu, 13/11/2026"
Cohesion: 0.22
Nodes (8): Các đường dữ liệu và lý do request còn lại, File/form đã sửa, Kiểm tra và phần chưa đo, Kết quả đo, Migration và lịch định kỳ, Phạm vi và phương pháp, Truy vấn kết quả giáo viên, Zunimo — rà soát request và dữ liệu, 13/11/2026

### Community 17 - "App.jsx"
Cohesion: 0.06
Nodes (56): App(), AssessmentsPage, ClassroomPage, KeyboardQuest, StudentNotifications, TypingGame, TypingSetup, companionSay() (+48 more)

### Community 18 - "classroom_hub.sql"
Cohesion: 0.19
Nodes (9): notification_class_post, notification_member_posts, public.class_member_removals, public.tipy_class_post_notice(), public.tipy_classroom_allowed(), public.tipy_classroom_hub(), public.tipy_remove_class_member(), public.tipy_star_class_scope() (+1 more)

### Community 19 - "public.profiles"
Cohesion: 0.08
Nodes (32): public.profiles, public.tipy_class_member_balances(), public.tipy_star_class_scope(), class_teachers_teacher, public.class_teachers, public.tipy_archive_post(), public.tipy_class_access(), public.tipy_class_member_balances() (+24 more)

### Community 20 - "tipy.js"
Cohesion: 0.09
Nodes (18): createNotificationEvents(), maxDuration, createHandler(), readCookies(), setSession(), backend, bus, calls (+10 more)

### Community 21 - "keyboard-quest.test.js"
Cohesion: 0.18
Nodes (14): createKeyboardQuest(), questRows(), questStart(), validateQuestFinish(), lessonForStage(), QUEST_CODE, createAnswers(), errorKind() (+6 more)

### Community 22 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, regions, rewrites

### Community 23 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, singleQuote, tabWidth, trailingComma

### Community 24 - "public.assessment_assignments"
Cohesion: 0.12
Nodes (42): public.tipy_assessment_best(), public.tipy_assessment_results(), assessment_class_targets_class, public.assessment_class_targets, public.tipy_assessment(), public.tipy_assessment_access(), public.tipy_sync_assessment_assignments(), assessment_attempts_due (+34 more)

### Community 25 - "public.star_rewards"
Cohesion: 0.10
Nodes (23): public.tipy_class_star_gift(), public.tipy_class_week_stars(), public.tipy_star_select_class(), star_rewards_class_week, student_actions_class_week, public.star_rewards, public.tipy_star_total(), public.student_admin_actions (+15 more)

### Community 26 - "public.tipy_publish_post"
Cohesion: 0.11
Nodes (18): class_attachments_owner, class_members_account, class_posts_owner, classes_owner, public.class_deletions, public.tipy_ack_class_files(), public.tipy_publish_post(), public.tipy_class_notifications() (+10 more)

### Community 27 - "ApiError"
Cohesion: 0.22
Nodes (10): ApiError, createAssessments(), safeLink(), text(), validateFile(), credential(), emailFor(), username() (+2 more)

### Community 28 - "Third-party notices"
Cohesion: 0.50
Nodes (3): Loading animation, Nunito, Third-party notices

### Community 29 - "ref_node_fs"
Cohesion: 0.15
Nodes (7): measurements, server, notificationMigration, notificationsFixture(), balanceMigration, id(), starFixture()

### Community 31 - "Cấu trúc và bảo trì TIPY STEM"
Cohesion: 0.08
Nodes (33): Ba vai trò và phạm vi giáo viên, Chọn thành viên theo lô, Cấu trúc và bảo trì TIPY STEM, Hiệu năng lớp học, Layout, chuyển động và ảnh Scratch, Mô hình dữ liệu, PlaySurface và kết quả, Quy trình sửa đổi (+25 more)

### Community 33 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @electric-sql/pglite@0.5.15, jsdom@^29.1.1, @playwright/test@^1.56.0, prettier@3.6.2, tailwindcss@^4.1.0, prettier, tailwindcss

### Community 34 - "public.student_notifications"
Cohesion: 0.14
Nodes (17): public.tipy_notifications_list(), public.tipy_notifications_present(), notification_assessment_published, notification_assignment, notification_class_member, notification_gift, public.student_notifications, public.tipy_notification_event() (+9 more)

### Community 35 - "games.js"
Cohesion: 0.27
Nodes (5): validateLevels(), validateProgress(), createGames(), createIdentity(), resultRows()

### Community 36 - "ref_node_fs"
Cohesion: 0.18
Nodes (5): options, python, root, sleep(), until()

### Community 37 - "check-classroom-hub.mjs"
Cohesion: 0.09
Nodes (14): errors, metrics, server, backend, calls, errors, handler, handlerRequest() (+6 more)

### Community 38 - "@tailwindcss/vite"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.1.0, @vitejs/plugin-react@^5.1.0, @tailwindcss/vite, @vitejs/plugin-react

### Community 39 - "schema.sql"
Cohesion: 0.24
Nodes (8): play_history_game_user, play_history_user_time, profiles_student_active, public.play_history, tipy_new_user, tipy_private.auth_limits, tipy_private.is_admin(), tipy_private.new_profile()

### Community 40 - "public.tipy_assessment"
Cohesion: 0.24
Nodes (4): assessment_start_requests_attempt, assessment_start_requests_exam, public.assessment_start_requests, public.tipy_assessment()

### Community 43 - "vite"
Cohesion: 0.50
Nodes (3): vite@^7.2.0, vite, directory

### Community 44 - "assessments.js"
Cohesion: 0.13
Nodes (7): measurements, server, assessmentResult(), assessmentSnapshot(), distinct(), invalid(), SUPPORTED_KEYS

### Community 46 - "KeyboardQuest.jsx"
Cohesion: 0.08
Nodes (35): server, server, manifest, output, contentMatches(), TEST_CONTENT, TEST_WORLDS, ContentPicker() (+27 more)

### Community 49 - "Ponytail"
Cohesion: 0.40
Nodes (4): Before you write, Levels, Ponytail, The smallest complete change

### Community 50 - "LetterTarget.jsx"
Cohesion: 0.38
Nodes (5): files, LETTER_STICKERS, stickerFor(), images, LetterTarget()

### Community 51 - "classroom-ui.test.js"
Cohesion: 0.40
Nodes (5): child, classroom, detail, sleep(), until()

### Community 53 - "check-teacher-roles.mjs"
Cohesion: 0.17
Nodes (6): access(), backend, calls, errors, handler, server

### Community 58 - "public.tipy_assessment"
Cohesion: 0.24
Nodes (4): assessment_start_requests_attempt, assessment_start_requests_exam, public.assessment_start_requests, public.tipy_assessment()

### Community 62 - "keyboard-quest-ui.test.js"
Cohesion: 0.70
Nodes (3): setup(), sleep(), until()

## Knowledge Gaps
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isUnlocked()` connect `KeyboardQuest.jsx` to `keyboard-quest.test.js`, `TIPY backend · Supabase + Vercel`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `TipyButton` be split into smaller, more focused modules?**
  _Cohesion score 0.0549567205618161 - nodes in this community are weakly interconnected._
- **Why does `Bản đồ chọn thế giới` connect `TIPY backend · Supabase + Vercel` to `KeyboardQuest.jsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `@playwright/test` be split into smaller, more focused modules?**
  _Cohesion score 0.09846153846153846 - nodes in this community are weakly interconnected._
- **Should `GameAudio` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Should `check-assessments.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `TIPY backend · Supabase + Vercel` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._