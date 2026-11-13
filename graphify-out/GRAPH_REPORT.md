# Graph Report - Web game Tipy  (2026-11-13)

## Corpus Check
- 178 files · ~112,870 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 20, .woff2 3, (none) 2)

## Summary
- 778 nodes · 2174 edges · 33 communities (23 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f1a56d31`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TipyButton
- classrooms.js
- curriculum.js
- App.jsx
- config.js
- check-assessments.mjs
- package.json
- TIPY backend · Supabase + Vercel
- ref_node_assert
- Zunimo — chuẩn giao diện dùng chung
- AvatarPicker.jsx
- Kết quả kiểm tra
- Hướng dẫn làm việc với Zunimo
- audio-ui.test.js
- jsdom
- ref_node_test
- Zunimo — rà soát request và dữ liệu, 13/11/2026
- admin-students.test.js
- LetterTarget.jsx
- assessment-class-access.test.js
- student-history.test.js
- classroom-ui.test.js
- vercel.json
- .prettierrc.json
- tipy-button.test.js
- dialog-viewport.test.js
- keyboard-quest-ui.test.js
- characters.test.js
- Third-party notices
- admin-ui.test.js
- alphabet/README.md

## God Nodes (most connected - your core abstractions)
1. `TipyButton()` - 58 edges
2. `api()` - 50 edges
3. `react` - 38 edges
4. `lucide-react` - 34 edges
5. `ApiError` - 33 edges
6. `Loading()` - 27 edges
7. `Modal()` - 24 edges
8. `App()` - 22 edges
9. `TIPY backend · Supabase + Vercel` - 20 edges
10. `createHandler()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Bản đồ chọn thế giới` --references--> `isUnlocked()`  [INFERRED]
  BACKEND.md → src/features/keyboard-quest/curriculum.js
- `Ranh giới trách nhiệm` --references--> `useCompanion()`  [INFERRED]
  ARCHITECTURE.md → src/hooks/useCompanion.js
- `button()` --indirect_call--> `TipyButton()`  [INFERRED]
  tests/tipy-button.test.js → src/components/TipyButton.jsx
- `assessmentResult()` --calls--> `matchesTarget()`  [EXTRACTED]
  server/modules/assessments.js → src/features/keyboard-quest/engine.js
- `classMembersView()` --calls--> `normalizeAvatar()`  [EXTRACTED]
  server/modules/classrooms.js → src/characters/catalog.js

## Import Cycles
- None detected.

## Communities (33 total, 10 thin omitted)

### Community 0 - "TipyButton"
Cohesion: 0.07
Nodes (72): lucide-react, @radix-ui/react-dialog, react, Account(), AccountPoints(), AudioSettings(), Loading(), Modal() (+64 more)

### Community 1 - "classrooms.js"
Cohesion: 0.07
Nodes (38): createHandler(), readCookies(), setSession(), createBackend(), ready(), ApiError, fail(), requireAdmin() (+30 more)

### Community 2 - "curriculum.js"
Cohesion: 0.07
Nodes (45): server, server, validateQuestFinish(), ADVENTURE_ART, ADVENTURE_WORLDS, adventureWorld(), appearances, worldProgress() (+37 more)

### Community 3 - "App.jsx"
Cohesion: 0.07
Nodes (34): App(), AssessmentsPage, ClassroomPage, KeyboardQuest, TypingGame, TypingSetup, companionKey(), normalizeCompanion() (+26 more)

### Community 4 - "config.js"
Cohesion: 0.09
Nodes (26): companionSay(), Keyboard(), contentMatches(), TEST_CONTENT, TEST_WORLDS, ContentPicker(), Game(), Setup() (+18 more)

### Community 5 - "check-assessments.mjs"
Cohesion: 0.05
Nodes (32): @playwright/test, classes, server, server, server, other, own, server (+24 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (36): dependencies, lucide-react@^0.468.0, @radix-ui/react-dialog@^1.3.1, react@^19.2.0, react-dom@^19.2.0, @supabase/supabase-js@2.119.0, devDependencies, @electric-sql/pglite@0.5.15 (+28 more)

### Community 7 - "TIPY backend · Supabase + Vercel"
Cohesion: 0.05
Nodes (40): Chọn thành viên theo lô, Cấu trúc và bảo trì TIPY STEM, Hiệu năng lớp học, Layout, chuyển động và ảnh Scratch, Mô hình dữ liệu, Quy trình sửa đổi, Quyền truy cập, Ranh giới trách nhiệm (+32 more)

### Community 8 - "ref_node_assert"
Cohesion: 0.11
Nodes (6): @electric-sql/pglite, db, newSQL, manifest, output, admin

### Community 9 - "Zunimo — chuẩn giao diện dùng chung"
Cohesion: 0.07
Nodes (26): 1. Định hướng, 2. Nút, 3. Màu và tương phản, 4. Chữ và icon, 5. Bố cục và nội dung, 6. Token và component, 7. Cổng kiểm tra, API nút (+18 more)

### Community 10 - "AvatarPicker.jsx"
Cohesion: 0.17
Nodes (16): server, characterFor(), CHARACTERS, LEGACY_CHARACTERS, normalizeAvatar(), companionSize(), bubblePosition(), createSpeechGate() (+8 more)

### Community 11 - "Kết quả kiểm tra"
Cohesion: 0.11
Nodes (17): Cập nhật database và backend, Cập nhật typing / admin riêng / lưu kết quả gọn, Cập nhật âm thanh, Giới hạn xác minh, Kiểm thử chuyển lớp, Kiểm tra sau triển khai, Kết quả kiểm tra, Loader phím vàng và hiệu ứng bảng top (+9 more)

### Community 12 - "Hướng dẫn làm việc với Zunimo"
Cohesion: 0.15
Nodes (12): 1. Định hướng chung, 2. Nút bấm, 3. Màu sắc, 4. Chữ và biểu tượng, 5. Bố cục và phản hồi, 6. Triển khai thống nhất, 7. Kiểm tra trước khi hoàn thành, graphify (+4 more)

### Community 13 - "audio-ui.test.js"
Cohesion: 0.19
Nodes (5): createGain(), createOscillator(), Parameter, sleep(), until()

### Community 14 - "jsdom"
Cohesion: 0.27
Nodes (7): jsdom, sleep(), until(), sleep(), until(), sleep(), until()

### Community 15 - "ref_node_test"
Cohesion: 0.24
Nodes (4): sleep(), until(), sleep(), until()

### Community 16 - "Zunimo — rà soát request và dữ liệu, 13/11/2026"
Cohesion: 0.22
Nodes (8): Các đường dữ liệu và lý do request còn lại, File/form đã sửa, Kiểm tra và phần chưa đo, Kết quả đo, Migration và lịch định kỳ, Phạm vi và phương pháp, Truy vấn kết quả giáo viên, Zunimo — rà soát request và dữ liệu, 13/11/2026

### Community 18 - "LetterTarget.jsx"
Cohesion: 0.39
Nodes (5): files, LETTER_STICKERS, stickerFor(), images, LetterTarget()

### Community 21 - "classroom-ui.test.js"
Cohesion: 0.40
Nodes (5): child, classroom, detail, sleep(), until()

### Community 22 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, framework, outputDirectory, regions, rewrites

### Community 23 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, singleQuote, tabWidth, trailingComma

### Community 26 - "keyboard-quest-ui.test.js"
Cohesion: 0.70
Nodes (3): setup(), sleep(), until()

### Community 28 - "Third-party notices"
Cohesion: 0.50
Nodes (3): Loading animation, Nunito, Third-party notices

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isUnlocked()` connect `curriculum.js` to `classrooms.js`, `TIPY backend · Supabase + Vercel`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `TipyButton` be split into smaller, more focused modules?**
  _Cohesion score 0.07029177718832891 - nodes in this community are weakly interconnected._
- **Why does `react` connect `TipyButton` to `curriculum.js`, `App.jsx`, `config.js`, `package.json`, `AvatarPicker.jsx`, `LetterTarget.jsx`, `tipy-button.test.js`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `classrooms.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06993828974434323 - nodes in this community are weakly interconnected._
- **Why does `Bản đồ chọn thế giới` connect `TIPY backend · Supabase + Vercel` to `curriculum.js`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `curriculum.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0715950715950716 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06628621597892889 - nodes in this community are weakly interconnected._