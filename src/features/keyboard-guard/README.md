# Vệ binh bàn phím — Zunimo

URL phát hành: `https://tipys.vercel.app/#typing/guard`, kho Gõ chữ `/#typing`.
Game thứ ba sau Chữ rơi và Bé chinh phục bàn phím. Route hash được App đọc khi mở
trực tiếp/reload; module tải lazy. Tài nguyên ở `public/guard-art`, không phụ thuộc
đường dẫn Windows. `art.js` ánh xạ đủ 45 ảnh và tải/giải mã trước lượt.

## Cấu hình dùng chung online

Tái sử dụng `public.games.config` và POST `save_game`; không tạo bảng/schema/RPC.
`db/keyboard_guard.sql` chỉ seed catalog (idempotent, ban đầu tắt). Bật sau khi bản
production READY. Backend kiểm tra Admin từ phiên và validate toàn bộ schema v3;
RLS hiện có chỉ cho anon/authenticated đọc game đang mở, không cấp UPDATE trực tiếp.
GET `guard_config` trả game đang mở, không trả bí mật hoặc dữ liệu người chơi.

Admin vào `/admin` → Tốc độ & độ khó, hoặc bánh răng cạnh Âm thanh khi chơi.
Mở cài đặt tạm dừng, X về bảng tạm dừng, Tiếp tục chơi. Nhập/đổi tab/mở đóng bảng
không có request. Lưu gửi một POST, cập nhật đúng catalog/config. Mỗi lần bắt đầu
hoặc chơi lại đọc một GET cấu hình mới, khóa bấm lặp khi đang tải, chụp bản riêng
cho cả lượt. Lưu sau đó không đổi lượt hiện tại; trình duyệt khác/reload đọc bản chung.

Bản local riêng vẫn ở `/dev/keyboard-guard`, chỉ development; dùng `localOnly`
và localStorage như trước để thử nghiệm, không ghi cấu hình production.

## Điểm và tài khoản

Game chưa ghi lịch sử, điểm/sao chỉ trong lượt; không cấp sao hoặc tự cộng điểm
vào tài khoản/bảng tuần. API `start` từ chối tạo lượt thống kê cho keyboard_guard
để không phát sinh đường cộng thưởng qua client trực tiếp. Hai game cũ giữ API,
lịch sử, điểm/sao và điều kiện mở khóa. Thư viện từ vựng không bị chỉnh sửa.

## Từ vựng và nhập liệu

`words.js` đọc trực tiếp `VOCABULARY` từ `../keyboard-quest/content.js` và dùng
`normalizeText`/`matchesTarget` từ engine hiện có. Màn 1 lấy 23 từ tối đa 8 ký tự
(tính cả khoảng trắng) ở Gia đình, Trường học, Động vật; ví dụ ông bà, em bé, cá heo,
chú chó, học sinh. Giữ nguyên dấu và chữ hiển thị; so khớp NFC, không phân biệt hoa/
thường. Không sửa nội dung, UI, tiến trình, quyền hoặc điều kiện mở khóa thư viện.
Bộ chọn Màn chơi dùng bộ từ phù hợp từng màn; vẫn dùng chung một cảnh chiến đấu thử nghiệm.

Đã bỏ toàn bộ hàng phím và nút mắt. `GuardWordInput.jsx` là input native ở ngay
trên tàu, giữ ngang khi tàu xoay. Backspace sửa ký tự, key repeat bị chặn. Dùng
composition events như LessonPlayer và bộ gõ của thiết bị, **không tự chuyển Telex**
nếu máy chưa bật bộ gõ. Khi IME ghép dấu chỉ hiển thị nháp, không bắn hoặc tính
thành công; compositionend chốt một lần, input trùng sau composition bị bỏ qua.

Khi có phần đầu từ phù hợp, chọn mục tiêu có nhãn đã vào vùng nhìn gần tàu nhất,
khóa ID tới khi hoàn thành hoặc mục tiêu va chạm. Gõ sai không đổi mục tiêu hoặc
trừ máu; nền đỏ/lời nhắc giúp sửa. Khi từ hoàn chỉnh đúng dấu, tạo một loạt ba viên
và xóa chuỗi nhập. Nếu mục tiêu va chạm giữa lúc gõ, xóa khóa/nháp, kể cả composition
đang dở. Không chọn các từ trùng nhau cùng lúc. Độ chính xác dùng số ký tự đã chốt
đúng/tổng ký tự thêm; không đếm nháp IME hoặc Backspace thành lần gõ thưởng.

Từ nằm dưới ảnh đá, nền tương phản, được phép xuống dòng. Nhịp sinh mặc định 4,5 giây
và khoảng dọc ít nhất 180 đơn vị thiết kế; dải vào giới hạn 40% bên trái để nhãn
không che HP/năng lượng. Tàu/đá mặc định còn 80% của bản trước, chữ không co theo.
Mục tiêu và toàn bộ nhãn sinh ngoài mép trên; Canvas/DOM cùng hệ 480×800.

## Thông số từng màn và đợt

- Chọn Màn 1/2/3, tốc độ cơ sở 0,5×–2×; mặc định 1× / 1,15× / 1,3×.
- Mỗi màn có đúng 3 đợt, chọn Đợt 1/2/3 trong cùng bảng:
  hệ số mặc định 1× / 1,25× / 1,6× (giới hạn 0,5×–3×);
  mỗi đợt 5 mục tiêu (1–100 nguyên), tối đa 3 (1–6 nguyên, không vượt tổng đợt),
  khoảng sinh 4,5 giây (0,5–10), sprite 11 FPS (6–24 nguyên).
- Tốc độ hiệu dụng = tốc độ màn × hệ số đợt. Hiển thị phép tính ngay trong form.
  Thiên thạch, nền, lớp sao phụ dùng một đồng hồ di chuyển; 50 px/giây là nền gốc.
  Nhịp sprite/đạn/nổ/hurt, số lượng và khoảng sinh không tự nhân theo tốc độ.
- Nền gốc chỉnh riêng từng màn (10–120 px/giây, mặc định 50), chuyển tốc
  0,2–2 giây, mặc định 0,5 giây; nội suy smoothstep hoàn tất đúng thời gian đặt.
  Đợt nghỉ giữ sprite và tốc độ đợt cũ; tới đầu đợt mới mới đổi sprite/tăng tốc.
- Khi chật màn hoặc nhãn quá gần, chờ chỗ trống, sinh tối đa một mục tiêu mỗi bước,
  không sinh bù dồn. Tổng màn là tổng ba đợt, không chia lại thành nhóm 5 cố định.
- Kích thước tàu/đá dùng chung ba màn, 50–120%, mặc định 80%; có xem trước.
- Bánh răng Cài đặt cạnh Âm thanh chỉ hiện khi bootstrap trả Admin. Mở sẽ tạm dừng;
  X đóng về bảng tạm dừng, Tiếp tục đóng và chơi tiếp. Đổi màn/đợt, kéo/nhập số,
  mở/đóng không phát request. Online tái sử dụng phiên/catalog từ App; không polling hoặc đường vòng Admin.
- Lưu chỉ ghi toàn bộ ba đợt của màn đang chọn và hai kích thước dùng chung.
  Khôi phục mặc định đặt lại cả ba đợt/thông số của màn đang chọn trong biểu mẫu,
  cần bấm Lưu; giữ màn khác và kích thước chung. Lượt mới chụp cấu hình sâu.
- Riêng bản dev local: localStorage giữ khóa `tipy-guard-config-v1`, schema version 3; chỉ lưu tại
  trình duyệt/origin/cổng này, không đồng bộ tài khoản/database/thiết bị.
  Đọc v1/v2 chuyển trong bộ nhớ, giữ tốc độ và kích thước; chia tổng cũ đều thành
  ba đợt (phần dư ưu tiên đợt trước), giới hạn đồng thời theo tổng đợt.
  Tổng cũ 1–2 được nâng lên 3 để mỗi đợt có ít nhất một mục tiêu; chỉ ghi khi Lưu.
  Lỗi localStorage phải báo lỗi, không báo lưu thành công giả.

## Sprite theo đợt và sát thương

Đã mở đủ ảnh gốc ngày 21/11/2026; 512×512, nền alpha; chép nguyên byte vào
`public/guard-art/`, ánh xạ từng file rõ trong `art.js`:

- Đợt 1: `flight_01.png` → `flight_06.png`.
- Đợt 2: `boost_01.png` → `boost_06.png`.
- Đợt 3: `boost_vfx_01.png` → `boost_vfx_06.png` (đã chứa tàu, chỉ vẽ một sprite).
- Hurt: `hurt_01.png` → `hurt_03.png`, một lần trong 0,3 giây, chỉ khi HP thật sự giảm.

Tải/giải mã cả 45 ảnh trước Chơi. Dùng chung vòng lặp/time, không timer riêng.
`SHIP_ANCHORS` đo mũi/cockpit trong từng bộ: flight (256,176), dài thân 318;
boost/boostVfx (256,165), dài thân 288; hurt (256,218), dài thân 336.
Renderer giữ cùng tâm thân, chiều dài hiển thị và khoảng mũi 38,4 ở cỡ mặc định;
không lấy alpha bounds gồm lửa/halo làm kích thước thân/collider.
Hurt ưu tiên, hết hurt chọn theo đợt hiện tại, kể cả vừa đổi đợt; không callback.
Khiên đầy vẫn phủ thân trong boost, chặn đòn có vòng sáng tan 0,3 giây, không hurt.
Bảo vệ ngắn sau va chạm độc lập; pause đóng băng sprite/hurt/chuyển tốc/nền,
replay đặt lại tất cả; HP 0 kết thúc ngay, không sự kiện muộn phục hồi game.

## Các thông số ở `level.js` và `settings.js`

- Tàu mặc định thân 76,8, đầu súng 38,4; đá 56; collider 33,6 (đều giảm 20%).
  Helper kích thước scale đầu súng, vùng va chạm; renderer scale khiên/đạn/nổ cùng.
- `ship.flightFps:11`; `background.scrollSpeed:50`, `starCount:24`, `starSpeed:36`.
- `travelSeconds:13` là mốc vận tốc đoạn đường cũ từ y=200; `spawn.speedReferenceY`
  chỉ để giữ mốc tốc độ, không phải tọa độ sinh thật. Tăng thời gian sẽ chậm hơn.
- `spawnSeconds:4.5`, `spawn.minGap:180`, `waveRestSeconds:2`.
- Mặc định 3 đợt × 5 mục tiêu; mỗi đợt dùng đúng tổng riêng đã đặt.
  Tối đa 3 cùng lúc, 5 máu/5 năng lượng, 10 điểm/đá.
- `burstCount:3`, `burstInterval:0.12`, `bulletSpeed:680`, `bulletLengthRatio:0.25`.
- `explosionSeconds:0.4`; `protectionSeconds:1`.
- Thắng còn 5 máu:3 sao; 3–4:2 sao; 1–2:1 sao; thua:0. Không cộng sao tài khoản.

Target falling → targeted → destroyed, hoặc falling → collided. Target đã khóa bắn
không gây sát thương hoặc nhận loạt khác. Phát đầu trúng chỉ thưởng một lần, dọn
cả viên chờ. Đạn giữ hướng cũ khi tàu đổi mục tiêu. Năng lượng đầy bật khiên, chặn
một va chạm rồi về 0; bảo vệ ngắn là trạng thái riêng. Dừng RAF/âm nhạc/đối tượng
khi kết thúc, cleanup listener khi rời route. Sau mục tiêu cuối chờ nổ hết trước
kết quả. Pause/blur/visibility dừng game clock; resume giữ nguyên vị trí.

## Tài nguyên và hoạt ảnh

Bảng ánh xạ rõ ở `art.js`, ảnh gốc từ `C:/Users/boof1/Pictures/Tài Nguyên/Vũ Trụ`,
sao chép nguyên byte vào `public/guard-art`:

| Local                             | Nguồn                                 |
| --------------------------------- | ------------------------------------- |
| hp_0.png–hp_5.png                 | cùng tên, bản mới 768×320             |
| energy_0.png–energy_5.png         | cùng tên, bản mới 768×320             |
| space_01.png–space_04.png         | cùng tên, 1024×1536                   |
| flight_01.png–flight_06.png       | cùng tên, 512×512                     |
| explosion_01.png–explosion_04.png | cùng tên, 512×512                     |
| ship.png (chỉ intro)              | Cute cyan spaceship with flame-2.png  |
| shield.png                        | Cyan Shielded Starship Sprite-3.png   |
| bolt.png                          | Cute cyan energy bolt.png             |
| meteor.png                        | Cheerful orange cratered meteor-4.png |

Bốn nền dịch xuống tuần hoàn đúng 384 px/bước; phase liên tục chọn khung và bù
phần dịch còn lại, không cộng chuyển động hai lần. Sáu khung bay chung neo thân
(256,176), thang thân 318, mũi y=17; lửa khác chiều dài nhưng không đổi crop/neo.
Khiên chỉ phủ vòng ngoài ảnh cũ, không che tàu bay bằng tàu tĩnh. Nổ đủ bốn khung,
cùng tâm/scale. Chờ toàn bộ Image.decode() trước Chơi, không timer riêng từng ảnh.

Browser báo reduced motion sẽ thấy **Chơi có hiệu ứng bay** hoặc **Chơi ít chuyển
động**. Có bật/tắt bay trong Tạm dừng; nhấp nháy trang trí vẫn theo reduced motion.
Âm thanh tổng hợp `useGameAudio` giữ cài đặt hiện có. Không có audio đọc từ riêng.
Không tuyên bố đây là màn Figma đã xác minh; theo yêu cầu/phác thảo và tài nguyên.

## Kiểm tra

`node --test tests/keyboard-guard*.test.js`, `npm run build`, `npm test`.
Với Vite port 4208: `node scripts/check-guard-words.mjs` (hoặc check-keyboard-guard),
`node scripts/check-guard-entry.mjs`, `node scripts/check-guard-motion.mjs`.
Chrome kiểm tra 5 kích thước và composition events mô phỏng; fixture Admin/Teacher/
Student. Chưa kiểm tra bộ gõ thật/điện thoại thật/Safari hoặc đăng nhập Admin thật.

Kiểm tra ba bộ sprite, hurt từng đợt, khiên, tốc độ/gear/cấu hình: `node scripts/check-guard-waves.mjs` (hoặc `check-guard-settings.mjs`) (API role fixture, không tài khoản thật).

Kiểm tra phát hành/catalog/cấu hình online hai thiết bị: `node scripts/check-guard-release.mjs`.
## Bài kiểm tra

Trong Lớp học → Kiểm tra → Tạo mới, chọn **Thêm Vệ binh bàn phím**, chọn mã nội dung trong ContentPicker chung và cấu hình 1–3 đợt. Bài đã gửi bất biến theo cơ chế hiện có; Chỉnh sửa nháp giữ đúng ID, bài đã gửi dùng Tạo bản mới. Chơi xem thử không tạo lượt hoặc kết quả.

`assessment.js` tạo snapshot/cấu hình bài, seed theo mã lượt và bằng chứng delta nhập + tick cố định. Backend `assessmentResult` tái dựng bằng cùng engine, không tin điểm/HP/tổng phá do browser gửi. `AssessmentsPage` dùng session chung để giữ bản thiết bị, tự lưu kết thúc và retry cùng requestId; lịch 30 giây bằng chứng chỉ dành cho bài có giờ đóng. Không gọi API mỗi phím, không thưởng sao luyện tập và không đụng quy tắc mở khóa thư viện tự do.

Migration `20261121115350_guard_assessments.sql` dùng bảng assessment hiện có, mở ba phần và nhãn game trong danh sách. Kiểm thử bằng `node scripts/check-guard-assessments.mjs` (database cô lập).
