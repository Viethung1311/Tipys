# TIPY backend · Supabase + Vercel

## Cập nhật lưu gọn và trang quản trị

- Trang quản trị riêng: `/admin`. Tốc độ rơi, khoảng xuất hiện và mật độ chữ của từng độ khó dùng ô số có nhãn, không cần sửa JSON.
- Luật Chữ rơi: tối đa 5 lần sai; sai lần thứ 6 kết thúc dù còn mạng. Hỗ trợ A–Z, 0–9 và `; ' , . /`, kể cả phím số bên phải.
- Chạy `db/schema.sql` rồi `db/compact_results.sql` khi dựng dự án mới. Database hiện tại đã được nâng cấp bằng file thứ hai.
- `player_game_stats` có đúng một hàng/học sinh/game với tối đa hai snapshot kết quả cao nhất và gần nhất, tổng thời gian và tổng lượt cộng dồn.
- `active_plays` tái sử dụng một hàng/học sinh/game. Khi lượt kết thúc, dữ liệu chi tiết ở hàng tạm được dọn; chỉ hai snapshot hoàn tất được giữ ở stats. Gửi lại heartbeat/kết quả không cộng trùng thời gian. Hai RPC dùng khóa hàng và transaction để giữ kết quả/tổng thời gian nhất quán.
- `play_history` cũ không bị xóa: được giữ làm bản dữ liệu trước chuyển đổi và không được backend mới ghi thêm. Kiểm tra lúc chuyển đổi: tổng 4.178 giây được giữ nguyên trong 8 bản tổng hợp học sinh/game. Từ bản này, số hàng lưu mới không tăng theo số lượt chơi.
- Thời gian là thời gian game thực chạy, loại đếm ngược và tạm dừng; không phải thời gian trang web mở. Độ chính xác đến giây, heartbeat 10 giây; mất kết nối/đóng cưỡng bức vẫn có giới hạn best-effort.

## Cấu trúc

File SQL Server gốc được chuyển thành `db/schema.sql` cho PostgreSQL. Ba bảng nghiệp vụ giữ quan hệ tài khoản → lịch sử ← game, không sao chép tên người/tên game vào lịch sử và không lưu tổng điểm vào hồ sơ.

- `auth.users`: mật khẩu và phiên do Supabase Auth quản lý.
- `profiles`: tên đăng nhập, tên hiển thị, role, trạng thái hoạt động; không có cột mật khẩu.
- `games`: mã ổn định, tên, mã bộ xử lý, trạng thái, cấu hình JSON riêng từng game.
- `play_history`: một hàng cho một lượt, điểm, thời gian thực chơi, kết quả và chỉ số game. `metrics` chứa thông số riêng và bản chụp cấu hình của lượt đó.
- `tipy_private.auth_limits`: giới hạn yêu cầu đăng nhập/đăng ký, dùng HMAC thay địa chỉ IP rõ.

## Các biến máy chủ

Chỉ nhập trong Vercel Environment Variables, loại Secret, Production. Không đặt tiền tố `VITE_`, không commit giá trị.

| Biến                        | Ý nghĩa                                                         |
| --------------------------- | --------------------------------------------------------------- |
| SUPABASE_URL                | Địa chỉ dự án TIPY                                              |
| SUPABASE_SERVICE_ROLE_KEY   | Secret/service_role key, chỉ ở server                           |
| TIPY_AUTH_SECRET            | Chuỗi ngẫu nhiên tối thiểu 32 ký tự, giữ cố định và lưu an toàn |
| TIPY_ADMIN_INITIAL_PASSWORD | Mật khẩu khởi tạo admin do chủ web nhập riêng                   |
| APP_ORIGIN                  | Origin chính thức; mặc định https://tipys.vercel.app            |

Admin được khởi tạo trong lần đăng nhập `admin` đầu tiên nếu mật khẩu khớp biến khởi tạo. Không có mật khẩu admin viết sẵn trong SQL, mã React hoặc repository. Sau khi admin được tạo, có thể gỡ biến mật khẩu khởi tạo; tài khoản vẫn đăng nhập bình thường.

Để dùng backend tên đăng nhập riêng, tắt public email sign-up trong Supabase Authentication. Backend dùng Admin API tạo học sinh và xác nhận email kỹ thuật; các em không cần địa chỉ email hoặc mã xác minh. Không dùng lại dự án này cho ứng dụng khác có quy trình Auth khác vì trigger hồ sơ yêu cầu username/full_name.

## Mật khẩu/PIN cho học sinh

Chấp nhận mọi mật khẩu không rỗng, không yêu cầu chữ hoa, số/ký tự đặc biệt hay độ dài tối thiểu. Giới hạn kích thước request và 1.024 byte cho ô mật khẩu chỉ chống dữ liệu quá lớn.

Server dùng HMAC-SHA256 với `TIPY_AUTH_SECRET` để tạo credential gửi tới Supabase Auth. Supabase tiếp tục tự băm và quản lý credential đó. Cách này cho phép PIN ngắn mà không đổi chính sách toàn cục của Auth hoặc lưu mật khẩu gốc. PIN ngắn vẫn dễ đoán; server giới hạn đăng nhập theo tài khoản và nguồn yêu cầu. Không đổi TIPY_AUTH_SECRET tùy tiện: đổi khóa này sẽ làm credential của các tài khoản cũ không còn khớp.

## API cùng origin

`GET /api/tipy?action=bootstrap|history|students`

`POST /api/tipy` với JSON và trường action:

- login/signup/logout
- start: bắt đầu lượt, user lấy từ phiên, không tin userId từ client
- progress: lưu định kỳ, kết thúc hoặc quit; kiểm tra điểm, chỉ số, thời gian và chủ sở hữu
- student_active: admin khóa/mở học sinh, không đổi vai trò từ frontend
- save_game: admin chỉnh/thêm metadata và cấu hình game

Cookie phiên HttpOnly, Secure trên production và SameSite=Lax; POST kiểm tra origin và JSON. Không trả access/refresh token cho mã React. Các endpoint quản trị kiểm tra hồ sơ/role hiện tại từ DB mỗi lần gọi; không tin role trong user_metadata.

RLS bật trên mọi bảng nghiệp vụ; học sinh chỉ đọc hồ sơ/lịch sử của mình; admin đọc tất cả. Client không được ghi trực tiếp các bảng. Mọi thao tác ghi đi qua backend có kiểm tra quyền. Các SECURITY DEFINER chỉ dùng cho trigger Auth và lookup RLS, đặt trong schema riêng, khóa search_path và thu hồi EXECUTE mặc định.

## Lượt chơi và cấu hình

Khách vẫn chơi được. Khi đăng nhập, mỗi lượt mới tạo history; lưu heartbeat mỗi 10 giây thời gian chơi, kết thúc lưu game_over, rời màn chơi lưu quit. Pagehide dùng sendBeacon best effort; nếu trình duyệt bị tắt cưỡng bức/mất mạng, hàng có thể còn in_progress. Không hứa lưu tuyệt đối lúc đóng trình duyệt.

Điểm Chữ rơi phải bằng số chữ đúng × 10; thời gian không vượt thời gian máy chủ; kết quả game_over cần đủ ba lần bỏ lỡ. Đây là kiểm tra tính hợp lệ, không phải hệ thống chống gian lận cho thi đấu có thưởng.

Admin thay cấu hình Chữ rơi trong Quản lý game. Thay đổi áp dụng cho lượt mới; lượt đang chơi giữ bản chụp cũ. Thêm game mới vào games và thêm bộ xử lý tương ứng trong React; API và lịch sử đã dùng chung, không cần tạo bảng lịch sử mới.

## Kiểm thử

`npm run build` rồi `npm test`.

Ngoài kiểm thử UI và game, PGlite chạy SQL bằng PostgreSQL thực trong môi trường thử với auth schema/roles mô phỏng. Kiểm tra idempotence, constraint, RLS, không tự nâng quyền, không đọc lịch sử người khác, và khóa tên admin. Đây không thay cho thử đăng nhập/session thực trên Supabase sau khi nhập biến môi trường.

Mã UI và SQL chỉ là một phần hoàn tất; cần lưu biến, triển khai và xác minh đăng ký/đăng nhập thật trước khi báo backend hoạt động.

## Portal / classroom migration

`db/classrooms.sql` adds five tables and a private Storage bucket: classes, class_members, student_avatars, class_posts, class_attachments. Applied successfully to project pjzsszjcymcfyamycidx. It contains no DROP, DELETE or TRUNCATE. Existing game/account/result data remains intact.

API classroom actions are authenticated. Every membership-gated action checks the database, and all administration actions require the DB admin role. Signed file downloads last 300 seconds; no public bucket. Full maintenance details: [ARCHITECTURE.md](ARCHITECTURE.md).

## MVP Bé chinh phục bàn phím

- Engine/game_code: keyboard_quest; màn hình tải riêng tại #typing/quest trong mục Gõ chữ. Dùng chung tài khoản, cookie, âm thanh và thống kê hiện có.
- Nội dung có phiên bản ở src/features/keyboard-quest/curriculum.js: 30 màn và 9 chủ đề, mỗi chủ đề 10 từ. Tám mã bài MVP được giữ nguyên; ba bài trải nghiệm vẫn mở sẵn. Telex dùng bộ gõ của thiết bị, không tự chuyển as thành á khi máy chưa bật bộ gõ.
- Sau schema hiện có, chỉ chạy db/keyboard_quest.sql. Migration thêm player_lesson_progress (một hàng/người/game/bài), hai RPC chỉ service_role được gọi và bản ghi game tắt mặc định. Không chạy lại schema gốc trên database đang dùng. Đã đối chiếu schema live trước khi bổ sung.
- GET quest_progress trả tiến độ của phiên hiện tại. POST start nhận gameCode, stageNumber, lessonId, kiểm tra điều kiện mở khóa. POST quest_finish kiểm tra chủ lượt, bài, câu trả lời, lỗi và thời gian; backend tự tính sao và độ chính xác. RPC ghi kết thúc lượt + tổng thời gian + tiến độ trong một transaction, cùng thứ tự khóa với RPC cũ. Gửi lại cùng lượt không cộng trùng. POST progress không được hoàn thành bài học.
- quest_reset đã ngừng phục vụ (404 khi đã đăng nhập); không còn nút xóa tiến độ. RPC SQL bảo trì giữ nguyên chỉ service_role để tương thích migration cũ. RLS vẫn giới hạn đọc theo quyền và chặn client ghi trực tiếp.
- Khách chỉ lưu bản chơi thử cục bộ, không tự gộp vào tài khoản. Không lưu chuỗi nhập sai tự do hoặc từng lần bấm phím. Sai dấu chỉ phân loại khi quan sát được khác biệt dấu, không suy đoán chuỗi Telex đã gõ.
- Heartbeat 10 giây, dừng đồng hồ khi tạm dừng/ẩn trang/mở dialog. Đóng cưỡng bức có thể mất tối đa khoảng heartbeat chưa gửi; không phải nhật ký kiểm chứng chống gian lận.
- Rollout: giữ game tắt đến khi frontend/backend mới được triển khai và kiểm tra đăng nhập thật. Sau đó admin bật game hiện có. Rollback: tắt game và quay về deployment trước, giữ bảng tiến độ để phục hồi.

## Bản mở rộng sau MVP

- Không có migration bổ sung: tiến độ tối đa 39 hàng/người/game (30 màn + 9 chủ đề) dùng cùng bảng/RPC hiện tại. Các mã bài và item MVP không đổi, curriculum_version vẫn 1 vì nội dung cũ giữ nguyên; lesson_id mới là phần bổ sung. Thư viện yêu cầu hoàn thành đủ 30 màn.
- Bài ôn chỉ đổi thứ tự các item cố định, xen kẽ nội dung từng sai với nội dung khác. Backend kiểm tra đủ tập ID duy nhất, câu trả lời và loại lỗi theo từng item; không tin thứ tự, sao hay xu gửi lên từ client.
- Hồ sơ lấy số đúng/sai, thời gian và lần luyện gần nhất từ các hàng tổng hợp; chỉ hiện tối đa 5 bài gần đây, không dựng nhật ký từng lần bấm. Reset xóa các tổng hợp bài nhưng vẫn giữ tổng thời gian tài khoản ở player_game_stats.
- Kho báu, sticker và xu riêng của module đã bỏ. Nhân vật vẫn thay trong Tài khoản qua avatar_save hiện có. Huy hiệu học tập vẫn suy ra từ tiến độ.
- Đua xe một mình dùng cùng bài học/chấm điểm, không đối thủ công khai hoặc đồng hồ đếm ngược. Tốc độ ký tự/phút chỉ tham khảo. Nghe mẫu dùng giọng tiếng Việt sẵn trên thiết bị; khi không có giọng, UI giải thích và vẫn có gợi ý chữ.
- GET quest_class_report chỉ admin, kiểm tra lớp đang mở trước truy vấn roster hiện tại. Một truy vấn nhúng tiến độ theo từng thành viên tránh N+1 và giới hạn hàng cấp gốc; báo cáo tối đa 300 thành viên theo giới hạn lớp hiện có, chỉ tải khi bấm xem/làm mới. Không trả tiến độ người ngoài lớp hoặc dữ liệu game khác.
- Gói bài học/thư viện và báo cáo tải riêng; không thêm ảnh mạng, quảng cáo, thư viện hay thông tin cá nhân thật. Chứng nhận chỉ xuất hiện sau đủ 30 màn và có thể in ngay từ trình duyệt.

## Điểm chung toàn website

GET points đọc đúng tài khoản của phiên (kể cả admin), dùng hai truy vấn độc lập chạy song song. Hàm thuần src/game/points.js cộng điểm cao nhất mỗi game, bỏ snapshot keyboard_quest vì đó là accuracy, rồi cộng 10 điểm mỗi sao tốt nhất của bài hợp lệ. Không ghi thêm bảng, không thay dữ liệu cũ, không cộng lại khi retry/replay. Bản ghi game/bài trùng được gộp theo mã trước khi tính.

Top lớp dùng cùng hàm và chỉ nhận các thành viên đã được kiểm tra quyền. Dữ liệu sao nhúng trong truy vấn roster hiện có, không thêm truy vấn từng học sinh. AccountPoints nhận sự kiện sau lưu thành công, hủy cập nhật khi đổi tài khoản, không hiển thị 0 giả khi API lỗi. Cache lớp được xóa khi điểm thay đổi. Store và ledger chi tiêu chưa thuộc phạm vi này.

## Bản đồ chọn thế giới

WorldMap chỉ hiển thị ô thế giới ở màn đầu; chọn một thế giới mới mount danh sách bài của thế giới đó. Không thêm API hoặc truy vấn khi chuyển thế giới, không thay dữ liệu/điểm/điều kiện mở khóa. Bỏ gợi ý bài hôm nay; luyện lại vẫn xen kẽ các câu từng sai trong engine hiện có. Kiểu chơi chuyển vào phần bài của thế giới.

## Avatar ảnh dùng chung

Chạy db/character_avatars.sql sau classrooms.sql trên database hiện có. Migration chuyển CHECK/default và 12 mã cũ sang icon_01–icon_36, không thêm bảng/cột hay xóa dữ liệu khác. Giữ nguyên RLS và API avatar/avatar_save: chỉ phiên hiện tại được ghi, mã phải thuộc danh mục chung. Giữ cột animal và metadata phụ kiện/màu để tương thích dữ liệu cũ.

CHECK vẫn chấp nhận 12 mã cũ để tab đang mở và deployment cũ còn ghi được trong lúc chuyển đổi/rollback. API mới chỉ cho chọn/lưu 36 mã ảnh; mọi nơi đọc dùng cùng ánh xạ nên không hiện lại emoji.
