# Graph Report - Web game Tipy  (2026-11-19)

## Corpus Check
- 231 files · ~165,691 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 32 file(s) not represented in the graph (top: .css 24, (none) 4, .woff2 3)

## Summary
- 1245 nodes · 3575 edges · 64 communities (48 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `090c79fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TipyButton
- classrooms.js
- ref_node_assert
- GameAudio
- App.jsx
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
- ApiError
- Zunimo — rà soát request và dữ liệu, 13/11/2026
- config.js
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
- check-teacher-roles.mjs
- alphabet/README.md
- companion-speech.js
- HomePage.jsx
- public.student_notifications
- assessments.js
- assessments.js
- check-classroom-hub.mjs
- Cấu trúc và bảo trì TIPY STEM
- schema.sql
- public.tipy_assessment
- notification-stream.test.js
- main.jsx
- Parameter
- TIPY STEM · Vườn phím nhỏ
- companion-settings.js
- KeyboardQuest.jsx
- assessment-class-access.test.js
- public.tipy_students_page
- Ponytail
- check-form-requests.mjs
- student-actions.test.js
- check-assessment-autosave.mjs
- public.tipy_assessment
- dialog-viewport.test.js
- student-history.test.js
- public.tipy_class_member_balances
- keyboard-quest-ui.test.js

## God Nodes (most connected - your core abstractions)
1. `public.profiles` - 102 edges
2. `TipyButton()` - 72 edges
3. `public.classes` - 68 edges
4. `public.class_members` - 67 edges
5. `api()` - 61 edges
6. `react` - 47 edges
7. `ApiError` - 43 edges
8. `lucide-react` - 39 edges
9. `public.star_rewards` - 35 edges
10. `Loading()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Bản đồ chọn thế giới` --references--> `isUnlocked()`  [INFERRED]
  BACKEND.md → src/features/keyboard-quest/curriculum.js
- `Ranh giới trách nhiệm` --references--> `useCompanion()`  [INFERRED]
  ARCHITECTURE.md → src/hooks/useCompanion.js
- `button()` --indirect_call--> `TipyButton()`  [INFERRED]
  tests/tipy-button.test.js → src/components/TipyButton.jsx
- `access()` --calls--> `ApiError`  [EXTRACTED]
  scripts/check-teacher-roles.mjs → server/errors.js
- `notify()` --calls--> `id()`  [EXTRACTED]
  scripts/check-notifications.mjs → tests/star-balance-fixture.js

## Import Cycles
- None detected.

## Communities (64 total, 16 thin omitted)

### Community 0 - "TipyButton"
Cohesion: 0.05
Nodes (102): lucide-react, @radix-ui/react-dialog, react, characterFor(), CHARACTERS, normalizeAvatar(), Account(), AccountPoints() (+94 more)

### Community 1 - "classrooms.js"
Cohesion: 0.11
Nodes (7): classMembersView(), ACCESSORIES, COLORS, FILE_TYPES, MAX_FILE_BYTES, imagePreview(), QUEST_CODE

### Community 2 - "ref_node_assert"
Cohesion: 0.12
Nodes (5): server, db, newSQL, button(), module

### Community 3 - "GameAudio"
Cohesion: 0.25
Nodes (7): AUDIO_DEFAULTS, GameAudio, normalizeAudio(), SOUNDS, tone(), useGameAudio(), setup()

### Community 4 - "App.jsx"
Cohesion: 0.20
Nodes (16): App(), AssessmentsPage, ClassroomPage, KeyboardQuest, StudentNotifications, TypingGame, TypingSetup, AudioSettings() (+8 more)

### Community 5 - "check-assessments.mjs"
Cohesion: 0.10
Nodes (19): classes, server, admin, games, server, student, students, classroom (+11 more)

### Community 6 - "package.json"
Cohesion: 0.06
Nodes (36): dependencies, lucide-react@^0.468.0, @radix-ui/react-dialog@^1.3.1, react@^19.2.0, react-dom@^19.2.0, @supabase/supabase-js@2.119.0, devDependencies, @electric-sql/pglite@0.5.15 (+28 more)

### Community 7 - "TIPY backend · Supabase + Vercel"
Cohesion: 0.08
Nodes (26): API cùng origin, Avatar ảnh dùng chung, Bài kiểm tra, Bản mở rộng sau MVP, Bản đồ chọn thế giới, Các biến máy chủ, Cấu trúc, Cập nhật lưu gọn và trang quản trị (+18 more)

### Community 8 - "ref_node_test"
Cohesion: 0.09
Nodes (6): @electric-sql/pglite, LEGACY_CHARACTERS, admin, until(), wait(), admin

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
Cohesion: 0.17
Nodes (11): jsdom, sleep(), until(), sleep(), until(), sleep(), until(), sleep() (+3 more)

### Community 15 - "ApiError"
Cohesion: 0.26
Nodes (8): ApiError, safeLink(), validateFile(), createIdentity(), credential(), emailFor(), username(), createTeachers()

### Community 16 - "Zunimo — rà soát request và dữ liệu, 13/11/2026"
Cohesion: 0.22
Nodes (8): Các đường dữ liệu và lý do request còn lại, File/form đã sửa, Kiểm tra và phần chưa đo, Kết quả đo, Migration và lịch định kỳ, Phạm vi và phương pháp, Truy vấn kết quả giáo viên, Zunimo — rà soát request và dữ liệu, 13/11/2026

### Community 17 - "config.js"
Cohesion: 0.09
Nodes (34): companionSay(), CompletionScreen(), Keyboard(), enterPlayFullscreen(), FINGER_HINTS, errorKind(), LessonPlayer(), files (+26 more)

### Community 18 - "public.classes"
Cohesion: 0.11
Nodes (25): class_attachments_owner, class_members_account, class_posts_owner, classes_owner, notification_class_post, notification_member_posts, public.class_member_removals, public.tipy_class_post_notice() (+17 more)

### Community 19 - "public.profiles"
Cohesion: 0.10
Nodes (27): public.profiles, class_teachers_teacher, public.class_teachers, public.tipy_archive_post(), public.tipy_class_access(), public.tipy_class_member_balances(), public.tipy_manages_class(), public.tipy_manages_student() (+19 more)

### Community 20 - "ref_node_fs"
Cohesion: 0.19
Nodes (7): hubFixture(), notificationMigration, notificationsFixture(), balanceMigration, id(), starFixture(), teacherFixture()

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
Cohesion: 0.12
Nodes (35): public.tipy_assessment_best(), public.tipy_assessment_results(), assessment_class_targets_class, public.assessment_class_targets, public.tipy_assessment(), public.tipy_assessment_access(), public.tipy_sync_assessment_assignments(), assessment_attempts_due (+27 more)

### Community 25 - "public.star_rewards"
Cohesion: 0.10
Nodes (25): public.tipy_class_star_gift(), public.tipy_class_week_stars(), public.tipy_star_select_class(), star_rewards_class_week, student_actions_class_week, public.star_rewards, public.student_admin_actions, public.tipy_class_star_board() (+17 more)

### Community 26 - "public.tipy_publish_post"
Cohesion: 0.13
Nodes (13): public.class_deletions, public.tipy_ack_class_files(), public.tipy_publish_post(), public.tipy_class_notifications(), class_attachments_post, class_members_user, class_posts_feed, public.class_attachments (+5 more)

### Community 27 - "tipy.js"
Cohesion: 0.10
Nodes (19): createNotificationEvents(), maxDuration, createHandler(), readCookies(), setSession(), backend, bus, calls (+11 more)

### Community 28 - "Third-party notices"
Cohesion: 0.50
Nodes (3): Loading animation, Nunito, Third-party notices

### Community 29 - "check-teacher-roles.mjs"
Cohesion: 0.12
Nodes (14): measurements, server, access(), backend, calls, errors, handler, server (+6 more)

### Community 31 - "companion-speech.js"
Cohesion: 0.23
Nodes (10): server, companionSize(), bubblePosition(), createSpeechGate(), DIALOGUE, PRIORITY, SPEECH_EVENT, Companion() (+2 more)

### Community 33 - "HomePage.jsx"
Cohesion: 0.24
Nodes (7): availableGames(), GAME_ENGINES, gameScreen(), OFFLINE_GAMES, GameLibrary(), HomePage(), Reveal()

### Community 34 - "public.student_notifications"
Cohesion: 0.20
Nodes (13): public.tipy_notifications_list(), public.tipy_notifications_present(), notification_assessment_published, notification_assignment, notification_class_member, notification_gift, public.student_notifications, public.tipy_notification_event() (+5 more)

### Community 35 - "assessments.js"
Cohesion: 0.14
Nodes (8): measurements, server, assessmentResult(), assessmentSnapshot(), createAssessments(), distinct(), invalid(), text()

### Community 36 - "assessments.js"
Cohesion: 0.15
Nodes (12): fail(), validateLevels(), validateProgress(), createGames(), createKeyboardQuest(), questRows(), questStart(), validateQuestFinish() (+4 more)

### Community 37 - "check-classroom-hub.mjs"
Cohesion: 0.14
Nodes (9): backend, calls, errors, handler, handlerRequest(), metrics, rooms, server (+1 more)

### Community 38 - "Cấu trúc và bảo trì TIPY STEM"
Cohesion: 0.15
Nodes (13): Ba vai trò và phạm vi giáo viên, Chọn thành viên theo lô, Cấu trúc và bảo trì TIPY STEM, Hiệu năng lớp học, Layout, chuyển động và ảnh Scratch, Mô hình dữ liệu, PlaySurface và kết quả, Quy trình sửa đổi (+5 more)

### Community 39 - "schema.sql"
Cohesion: 0.24
Nodes (8): play_history_game_user, play_history_user_time, profiles_student_active, public.play_history, tipy_new_user, tipy_private.auth_limits, tipy_private.is_admin(), tipy_private.new_profile()

### Community 40 - "public.tipy_assessment"
Cohesion: 0.24
Nodes (4): assessment_start_requests_attempt, assessment_start_requests_exam, public.assessment_start_requests, public.tipy_assessment()

### Community 41 - "notification-stream.test.js"
Cohesion: 0.15
Nodes (4): createNotifications(), student(), status(), watchNotifications()

### Community 44 - "TIPY STEM · Vườn phím nhỏ"
Cohesion: 0.22
Nodes (9): Chạy dự án, Cấu trúc, Kiểm tra và build, Luật chơi, Portal và lớp học, TIPY STEM · Vườn phím nhỏ, Trang chủ TIPY STEM Cẩm Lệ, Triển khai (+1 more)

### Community 45 - "companion-settings.js"
Cohesion: 0.53
Nodes (6): companionKey(), normalizeCompanion(), readCompanion(), saveCompanion(), save(), useCompanion()

### Community 46 - "KeyboardQuest.jsx"
Cohesion: 0.05
Nodes (50): @playwright/test, server, other, own, server, server, server, server (+42 more)

### Community 49 - "Ponytail"
Cohesion: 0.40
Nodes (4): Before you write, Levels, Ponytail, The smallest complete change

### Community 50 - "check-form-requests.mjs"
Cohesion: 0.29
Nodes (6): classes, errors, exams, reads, server, writes

### Community 53 - "check-assessment-autosave.mjs"
Cohesion: 0.15
Nodes (7): errors, metrics, server, contentMatches(), TEST_CONTENT, TEST_WORLDS, ContentPicker()

### Community 58 - "public.tipy_assessment"
Cohesion: 0.24
Nodes (4): assessment_start_requests_attempt, assessment_start_requests_exam, public.assessment_start_requests, public.tipy_assessment()

### Community 62 - "keyboard-quest-ui.test.js"
Cohesion: 0.70
Nodes (3): setup(), sleep(), until()

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `TipyButton` to `HomePage.jsx`, `ref_node_assert`, `GameAudio`, `App.jsx`, `package.json`, `main.jsx`, `companion-settings.js`, `KeyboardQuest.jsx`, `config.js`, `check-assessment-autosave.mjs`, `companion-speech.js`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `TipyButton` be split into smaller, more focused modules?**
  _Cohesion score 0.053269489750112226 - nodes in this community are weakly interconnected._
- **Why does `isUnlocked()` connect `KeyboardQuest.jsx` to `assessments.js`, `TIPY backend · Supabase + Vercel`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `classrooms.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11231884057971014 - nodes in this community are weakly interconnected._
- **Why does `TIPY backend · Supabase + Vercel` connect `TIPY backend · Supabase + Vercel` to `ARCHITECTURE.md`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `ref_node_assert` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `check-assessments.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._