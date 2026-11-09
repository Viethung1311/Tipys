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

| Biến | Ý nghĩa |
|---|---|
| SUPABASE_URL | Địa chỉ dự án TIPY |
| SUPABASE_SERVICE_ROLE_KEY | Secret/service_role key, chỉ ở server |
| TIPY_AUTH_SECRET | Chuỗi ngẫu nhiên tối thiểu 32 ký tự, giữ cố định và lưu an toàn |
| TIPY_ADMIN_INITIAL_PASSWORD | Mật khẩu khởi tạo admin do chủ web nhập riêng |
| APP_ORIGIN | Origin chính thức; mặc định https://tipys.vercel.app |

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
