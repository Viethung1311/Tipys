# Graph Report - Web game Tipy  (2026-11-20)

## Corpus Check
- 233 files · ~166,285 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: .css 26, (none) 4, .woff2 3)

## Summary
- 1240 nodes · 3532 edges · 79 communities (65 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7bce3e1f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api
- classrooms.js
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
- check-star-deductions.mjs
- Zunimo — rà soát request và dữ liệu, 13/11/2026
- config.js
- public.classes
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
- graphify.mjs
- check-classroom-hub.mjs
- @tailwindcss/vite
- schema.sql
- public.tipy_assessment
- notification-stream.test.js
- main.jsx
- vite
- assessments.js
- admin-students.test.js
- WorldMap.jsx
- App.jsx
- admin_students.sql
- Ponytail
- LetterTarget.jsx
- classroom-ui.test.js
- TipyButton
- check-teacher-roles.mjs
- public.tipy_assessment
- dialog-viewport.test.js
- student-history.test.js
- AssessmentsPage.jsx
- keyboard-quest-ui.test.js
- TipyButton.jsx
- react
- curriculum.js
- KeyboardQuest.jsx
- ResultViews.jsx
- check-assessment-autosave.mjs
- TIPY STEM · Vườn phím nhỏ
- AdminAssessments.jsx
- AccountPoints.jsx
- check-site-ui.mjs
- assessments/content.js
- student-actions.test.js
- ranked.js
- HomePage.jsx

## God Nodes (most connected - your core abstractions)
1. `public.profiles` - 102 edges
2. `TipyButton()` - 73 edges
3. `public.classes` - 68 edges
4. `public.class_members` - 67 edges
5. `api()` - 61 edges
6. `react` - 48 edges
7. `ApiError` - 43 edges
8. `lucide-react` - 40 edges
9. `public.star_rewards` - 35 edges
10. `public.assessment_assignments` - 28 edges

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

## Communities (79 total, 14 thin omitted)

### Community 0 - "api"
Cohesion: 0.18
Nodes (23): react, ResultsTable(), fieldError(), ValidatedForm(), validateForm(), Pagination(), StudentActionDialog(), StudentHistory() (+15 more)

### Community 1 - "classrooms.js"
Cohesion: 0.13
Nodes (7): classMembersView(), createClassrooms(), safeLink(), ACCESSORIES, COLORS, FILE_TYPES, MAX_FILE_BYTES

### Community 2 - "@playwright/test"
Cohesion: 0.11
Nodes (13): @playwright/test, server, metrics, server, server, other, own, server (+5 more)

### Community 3 - "GameAudio"
Cohesion: 0.14
Nodes (9): AUDIO_DEFAULTS, GameAudio, normalizeAudio(), SOUNDS, tone(), useGameAudio(), FakeContext, Parameter (+1 more)

### Community 4 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, format, format:check, graphify, pretest, preview (+1 more)

### Community 5 - "check-assessments.mjs"
Cohesion: 0.10
Nodes (20): classes, server, classes, errors, exams, reads, server, writes (+12 more)

### Community 6 - "package.json"
Cohesion: 0.18
Nodes (12): dependencies, lucide-react@^0.468.0, @radix-ui/react-dialog@^1.3.1, react@^19.2.0, react-dom@^19.2.0, @supabase/supabase-js@2.119.0, name, private (+4 more)

### Community 7 - "TIPY backend · Supabase + Vercel"
Cohesion: 0.08
Nodes (26): API cùng origin, Avatar ảnh dùng chung, Bài kiểm tra, Bản mở rộng sau MVP, Bản đồ chọn thế giới, Các biến máy chủ, Cấu trúc, Cập nhật lưu gọn và trang quản trị (+18 more)

### Community 8 - "ref_node_assert"
Cohesion: 0.11
Nodes (7): @electric-sql/pglite, db, newSQL, LEGACY_CHARACTERS, until(), wait(), admin

### Community 9 - "Zunimo — chuẩn giao diện dùng chung"
Cohesion: 0.09
Nodes (22): 1. Nguồn chuẩn và mức xác minh, 2. Định hướng, 3.1. Bộ nút theo ảnh Sources — bản duyệt local ngày 20/11/2026, 3. Màu sắc, 4. Chữ và biểu tượng, 5. Khung, khoảng cách và responsive, 6.1. Tương tác chung, 6.2. Hành vi từng khu vực (+14 more)

### Community 10 - "public.tipy_student_reset"
Cohesion: 0.11
Nodes (22): active_plays_game, player_game_stats_game, public.active_plays, public.player_game_stats, public.tipy_begin_play(), public.tipy_save_play(), player_lesson_progress_game, public.player_lesson_progress (+14 more)

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
Cohesion: 0.12
Nodes (13): jsdom, sleep(), until(), sleep(), until(), sleep(), until(), sleep() (+5 more)

### Community 15 - "check-star-deductions.mjs"
Cohesion: 0.15
Nodes (7): measurements, server, measurements, server, requireEducator(), createStars(), createStudents()

### Community 16 - "Zunimo — rà soát request và dữ liệu, 13/11/2026"
Cohesion: 0.22
Nodes (8): Các đường dữ liệu và lý do request còn lại, File/form đã sửa, Kiểm tra và phần chưa đo, Kết quả đo, Migration và lịch định kỳ, Phạm vi và phương pháp, Truy vấn kết quả giáo viên, Zunimo — rà soát request và dữ liệu, 13/11/2026

### Community 17 - "config.js"
Cohesion: 0.10
Nodes (29): server, bubblePosition(), createSpeechGate(), DIALOGUE, PRIORITY, SPEECH_EVENT, CompanionSpeech(), Keyboard() (+21 more)

### Community 18 - "public.classes"
Cohesion: 0.13
Nodes (36): public.tipy_class_star_board(), notification_class_post, notification_member_posts, public.class_member_removals, public.tipy_class_post_notice(), public.tipy_classroom_allowed(), public.tipy_classroom_hub(), public.tipy_notification_visible() (+28 more)

### Community 19 - "public.profiles"
Cohesion: 0.08
Nodes (30): public.profiles, public.tipy_class_member_balances(), public.tipy_star_class_scope(), class_teachers_teacher, public.class_teachers, public.tipy_archive_post(), public.tipy_assessment_results(), public.tipy_class_access() (+22 more)

### Community 20 - "tipy.js"
Cohesion: 0.08
Nodes (19): createNotificationEvents(), maxDuration, createHandler(), readCookies(), setSession(), backend, bus, calls (+11 more)

### Community 21 - "keyboard-quest.test.js"
Cohesion: 0.18
Nodes (12): companionSay(), createAnswers(), errorKind(), gradeLesson(), matchesTarget(), normalizeText(), withoutMarks(), LessonPlayer() (+4 more)

### Community 22 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, regions, rewrites

### Community 23 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, singleQuote, tabWidth, trailingComma

### Community 24 - "public.assessment_assignments"
Cohesion: 0.11
Nodes (33): public.tipy_assessment_best(), public.tipy_assessment_results(), assessment_class_targets_class, public.assessment_class_targets, public.tipy_assessment(), public.tipy_assessment_access(), public.tipy_sync_assessment_assignments(), assessment_attempts_due (+25 more)

### Community 25 - "public.star_rewards"
Cohesion: 0.10
Nodes (25): public.tipy_class_star_gift(), public.tipy_class_week_stars(), public.tipy_star_select_class(), star_rewards_class_week, student_actions_class_week, public.star_rewards, public.student_admin_actions, public.tipy_class_star_board() (+17 more)

### Community 26 - "public.tipy_publish_post"
Cohesion: 0.16
Nodes (9): public.class_deletions, public.tipy_ack_class_files(), public.tipy_publish_post(), public.tipy_class_notifications(), public.class_attachments, public.tipy_publish_post(), public.tipy_notifications_present(), public.tipy_publish_post() (+1 more)

### Community 27 - "ApiError"
Cohesion: 0.31
Nodes (13): ApiError, requireAdmin(), createAssessments(), text(), uuid(), validateFile(), createIdentity(), credential() (+5 more)

### Community 28 - "Third-party notices"
Cohesion: 0.50
Nodes (3): Loading animation, Nunito, Third-party notices

### Community 29 - "ref_node_fs"
Cohesion: 0.20
Nodes (7): hubFixture(), notificationMigration, notificationsFixture(), balanceMigration, id(), starFixture(), teacherFixture()

### Community 31 - "Cấu trúc và bảo trì TIPY STEM"
Cohesion: 0.15
Nodes (13): Ba vai trò và phạm vi giáo viên, Chọn thành viên theo lô, Cấu trúc và bảo trì TIPY STEM, Hiệu năng lớp học, Layout, chuyển động và ảnh Scratch, Mô hình dữ liệu, PlaySurface và kết quả, Quy trình sửa đổi (+5 more)

### Community 33 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @electric-sql/pglite@0.5.15, jsdom@^29.1.1, @playwright/test@^1.56.0, prettier@3.6.2, tailwindcss@^4.1.0, prettier, tailwindcss

### Community 34 - "public.student_notifications"
Cohesion: 0.20
Nodes (13): public.tipy_notifications_list(), public.tipy_notifications_present(), notification_assessment_published, notification_assignment, notification_class_member, notification_gift, public.student_notifications, public.tipy_notification_event() (+5 more)

### Community 35 - "games.js"
Cohesion: 0.21
Nodes (10): fail(), validateLevels(), validateProgress(), createGames(), createKeyboardQuest(), questRows(), questStart(), lessonForStage() (+2 more)

### Community 36 - "graphify.mjs"
Cohesion: 0.33
Nodes (3): options, python, root

### Community 37 - "check-classroom-hub.mjs"
Cohesion: 0.14
Nodes (9): backend, calls, errors, handler, handlerRequest(), metrics, rooms, server (+1 more)

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
Cohesion: 0.12
Nodes (7): assessmentResult(), assessmentSnapshot(), distinct(), invalid(), SUPPORTED_KEYS, draft(), scope()

### Community 46 - "WorldMap.jsx"
Cohesion: 0.19
Nodes (13): manifest, output, ADVENTURE_ART, ADVENTURE_WORLDS, adventureWorld(), appearances, worldProgress(), AdventureScene() (+5 more)

### Community 47 - "App.jsx"
Cohesion: 0.19
Nodes (19): App(), AssessmentsPage, ClassroomPage, KeyboardQuest, StudentNotifications, TypingGame, TypingSetup, companionKey() (+11 more)

### Community 48 - "admin_students.sql"
Cohesion: 0.20
Nodes (5): class_attachments_owner, class_members_account, class_posts_owner, classes_owner, public.tipy_students_page()

### Community 49 - "Ponytail"
Cohesion: 0.40
Nodes (4): Before you write, Levels, Ponytail, The smallest complete change

### Community 50 - "LetterTarget.jsx"
Cohesion: 0.39
Nodes (5): files, LETTER_STICKERS, stickerFor(), images, LetterTarget()

### Community 51 - "classroom-ui.test.js"
Cohesion: 0.40
Nodes (5): child, classroom, detail, sleep(), until()

### Community 52 - "TipyButton"
Cohesion: 0.20
Nodes (21): ActionMenu(), AudioSettings(), Loading(), Modal(), TipyButton(), Attachment(), ClassAssessmentSender(), ClassMessages() (+13 more)

### Community 53 - "check-teacher-roles.mjs"
Cohesion: 0.17
Nodes (6): access(), backend, calls, errors, handler, server

### Community 58 - "public.tipy_assessment"
Cohesion: 0.24
Nodes (4): assessment_start_requests_attempt, assessment_start_requests_exam, public.assessment_start_requests, public.tipy_assessment()

### Community 61 - "AssessmentsPage.jsx"
Cohesion: 0.12
Nodes (22): assessmentSucceeded(), CompletionScreen(), enterPlayFullscreen(), PlaySurface(), AdminAssessments, AssessmentRunner(), AssessmentsPage(), FallingGame (+14 more)

### Community 62 - "keyboard-quest-ui.test.js"
Cohesion: 0.70
Nodes (3): setup(), sleep(), until()

### Community 63 - "TipyButton.jsx"
Cohesion: 0.12
Nodes (12): lucide-react, icons, imagePreview(), EMPTY, PostComposer(), previewLink(), AdventureHeader(), StudentNotifications() (+4 more)

### Community 64 - "react"
Cohesion: 0.29
Nodes (10): @radix-ui/react-dialog, characterFor(), CHARACTERS, normalizeAvatar(), Account(), Avatar(), AvatarPicker(), ClassAchievements() (+2 more)

### Community 65 - "curriculum.js"
Cohesion: 0.15
Nodes (8): server, EXTRA_LESSONS, VOCABULARY, CURRICULUM_VERSION, definitions, FINGER_HINTS, LIBRARY_LESSONS, prepare()

### Community 66 - "KeyboardQuest.jsx"
Cohesion: 0.38
Nodes (9): validateQuestFinish(), ALL_LESSONS, findLesson(), LESSONS, updatedProgress(), KeyboardQuest(), LearningProfile(), learningSummary() (+1 more)

### Community 67 - "ResultViews.jsx"
Cohesion: 0.44
Nodes (11): AssessmentSummary(), SectionResults(), dateVN(), duration(), AttemptHistory(), BestResults(), Outcome(), ResultBanner() (+3 more)

### Community 69 - "check-assessment-autosave.mjs"
Cohesion: 0.18
Nodes (3): errors, metrics, server

### Community 70 - "TIPY STEM · Vườn phím nhỏ"
Cohesion: 0.22
Nodes (9): Chạy dự án, Cấu trúc, Kiểm tra và build, Luật chơi, Portal và lớp học, TIPY STEM · Vườn phím nhỏ, Trang chủ TIPY STEM Cẩm Lệ, Triển khai (+1 more)

### Community 71 - "AdminAssessments.jsx"
Cohesion: 0.39
Nodes (7): AdminAssessments(), editOf(), empty(), localVN(), Recipients(), TestPagination(), availability()

### Community 72 - "AccountPoints.jsx"
Cohesion: 0.43
Nodes (5): AccountPoints(), isPlaySurfaceActive(), keyFor(), loadPending(), useNotifications()

### Community 73 - "check-site-ui.mjs"
Cohesion: 0.29
Nodes (5): admin, games, server, student, students

### Community 74 - "assessments/content.js"
Cohesion: 0.48
Nodes (5): contentMatches(), TEST_CONTENT, TEST_WORLDS, ContentPicker(), WORLDS

### Community 76 - "ranked.js"
Cohesion: 0.40
Nodes (3): RANKED_HARD, RANKED_KEYS, RANKED_RULE

### Community 78 - "HomePage.jsx"
Cohesion: 0.24
Nodes (7): availableGames(), GAME_ENGINES, gameScreen(), OFFLINE_GAMES, GameLibrary(), HomePage(), Reveal()

## Knowledge Gaps
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isUnlocked()` connect `WorldMap.jsx` to `curriculum.js`, `KeyboardQuest.jsx`, `games.js`, `TIPY backend · Supabase + Vercel`, `keyboard-quest.test.js`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `classrooms.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._
- **Why does `TIPY backend · Supabase + Vercel` connect `TIPY backend · Supabase + Vercel` to `ARCHITECTURE.md`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `@playwright/test` be split into smaller, more focused modules?**
  _Cohesion score 0.11462450592885376 - nodes in this community are weakly interconnected._
- **Why does `Bản đồ chọn thế giới` connect `TIPY backend · Supabase + Vercel` to `WorldMap.jsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `GameAudio` be split into smaller, more focused modules?**
  _Cohesion score 0.14022988505747128 - nodes in this community are weakly interconnected._
- **Should `check-assessments.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._