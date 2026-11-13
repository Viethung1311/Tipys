# Zunimo — rà soát request và dữ liệu, 13/11/2026

## Phạm vi và phương pháp

Đã đọc AGENTS.md, design-system/tipy/MASTER.md, ARCHITECTURE.md và BACKEND.md. Lần theo fetch trong src/game/backend.js, các component gọi API, handler api/tipy.js, service server/modules và SQL tương ứng. Frontend không gọi Supabase/RPC/Edge Functions trực tiếp và không có đăng ký Realtime. Ngoài API cùng origin, PostComposer chỉ PUT tệp đã được backend cấp quyền.

Đếm request `/api/tipy` bằng Chrome/Playwright, dùng tài khoản và dữ liệu giả, không gửi bài/xóa/tặng sao thật. Idle 60 giây là chờ thực, không tua đồng hồ. Không tính ảnh/font/chunk vào số request API. Các cặp trước/sau dùng cùng fixture và thao tác. Không đọc Logs Explorer hoặc gọi công cụ tìm kiếm log.

## Kết quả đo

| Luồng                                                | Request trước |           Request sau | Thay đổi chính                                 |
| ---------------------------------------------------- | ------------: | --------------------: | ---------------------------------------------- |
| Mở trang chủ, học sinh chưa có lớp                   |             3 |                     3 | bootstrap, avatar, stars; mỗi loại cần một lần |
| Trang chủ đứng yên 60 giây                           |             1 |                     0 | Bỏ polling sao mỗi phút                        |
| Gõ chữ rồi về trang chủ                              |             0 |                     0 | Giữ dữ liệu layout và catalog                  |
| Bài kiểm tra trống đứng yên 31 giây, sau lần tải đầu |             2 |                     0 | Bỏ polling danh sách mỗi 15 giây               |
| Vào lớp và mở Top thành tích                         |             4 |                     3 | Bỏ đọc sao cá nhân chỉ vì đọc bảng xếp hạng    |
| Form tạo lớp/tạo bài/tặng sao: dữ liệu sai           |       Chưa đo |             0 mỗi lần | Nút và Enter kiểm tra tại máy trước API        |
| Ba form trên: gửi hợp lệ bằng Enter hoặc bấm đúp     |       Chưa đo | 1 request lưu mỗi lần | Ref khóa đồng bộ, cùng hàm submit              |
| Trang quản trị: đọc trang học sinh ban đầu           |       Chưa đo |                     1 | Dùng cùng tham số/cache cho overview và bảng   |
| Đọc lại cùng trang kết quả quản trị trong 30 giây    |       Chưa đo |         0 sau lần đầu | Đã kiểm tra bằng bộ đếm fetch trong unit test  |
| Flush/cleanup checkpoint không thay đổi              |       Chưa đo |                     0 | Không tăng sequence chỉ vì gọi flush           |

Số request trước của các form/bảng quản trị chưa được thu bằng trình duyệt trước khi chỉnh; không suy số từ mã nguồn thành số đo.

### Truy vấn kết quả giáo viên

PGlite riêng: 30 học sinh, mỗi em 10 lượt, đề có 327 mục. Chạy cùng bộ lọc/sắp xếp và EXPLAIN ANALYZE trước/sau, không thêm index.

| Chỉ số                                       |  Trước |   Sau |
| -------------------------------------------- | -----: | ----: |
| JSON trả về, byte chưa nén                   | 19.515 | 4.801 |
| Tổng hàng qua các nút quét, nhân số vòng lặp | 18.251 | 2.250 |
| Học sinh trong trang                         |      7 |     7 |

Đây là số hàng xử lý cộng dồn trong plan fixture, không phải số hàng duy nhất, số trang đĩa hay GB. Đã đối chiếu toàn bộ nội dung hiển thị trước/sau bằng assert; chỉ bỏ sections và best_sections không dùng ở bảng tổng hợp. Thành tích tốt nhất/từng lượt vẫn lấy qua Chi tiết. Thời gian và số hàng trên production: **Chưa đo**, không chạy EXPLAIN ANALYZE dữ liệu học sinh thật.

## Các đường dữ liệu và lý do request còn lại

| Luồng                       | Khi tải/ghi                                                                                                    | Backend và giới hạn                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Trang chủ/header            | bootstrap một lần, avatar/sao sau khi biết tài khoản; sao cập nhật khi quay lại tab hoặc thưởng đúng tài khoản | Auth + profile; catalog và lớp chạy song song; avatar riêng người dùng; RPC sao riêng người dùng                                                |
| Lớp học                     | Vào/quay lại lớp xác minh danh sách lớp, tải classroom và bảng thành tích                                      | Kiểm tra thành viên trước nội dung; bài đăng 20 mục/trang; roster giới hạn hiện có 300; không còn lấy tiến độ từng bài/điểm cao nhất không dùng |
| Tệp lớp                     | Chỉ khi bấm mở; ảnh lazy, preview; tải tệp kiểm tra quyền lại                                                  | Không cache quyền học sinh hoặc đưa URL Storage có ký ra ngoài                                                                                  |
| Top thành tích              | Khi mở lớp, đổi tuần hoặc chủ động thử lại; đổi hai tab không gọi lại                                          | Một RPC, quyền lớp ở server; bỏ event đọc bảng làm tải sao header                                                                               |
| Bài kiểm tra                | Tải danh sách khi mở/đổi trang; chi tiết khi bấm; kiểm tra lại khi quay lại tab                                | Danh sách 20/trang; giao lớp theo thành viên hiện tại, không chỉ snapshot người nhận                                                            |
| Kết quả giáo viên           | Debounce tìm kiếm 200 ms; lọc/sắp xếp/phân trang ở SQL; chi tiết khi bấm                                       | 7 học sinh/trang; tổng số lượt/tên lớp tính sau phân trang; không trả kho nội dung/tốt nhất mọi lượt ở bảng chính                               |
| Kết quả học sinh            | Chỉ tài khoản trong phiên, tải khi mở                                                                          | API/RPC chặn sửa userId để đọc người khác; lượt 20/trang                                                                                        |
| Quản lý học sinh/thành viên | Debounce 150 ms, 7/trang; một mutation bulk cho các hàng đã chọn                                               | SQL lọc/sắp xếp trước phân trang, quyền admin giữ nguyên                                                                                        |
| Lịch sử luyện               | Chỉ khi mở/chọn học sinh; bộ chọn cũng tìm kiếm/phân trang 7                                                   | Không còn tải 200 hồ sơ qua students; chỉ giữ best/latest đã có, không dựng lịch sử giả                                                         |
| Chơi luyện tập              | Đồng hồ/animation/phím chạy ở máy; heartbeat khoảng 10 giây khi có tiến độ, kết thúc/thoát cần ghi             | Hàng đợi giữ thứ tự; backend chấm, ngăn gửi lại/ghi ngược                                                                                       |
| Làm kiểm tra                | Coalesce thay đổi, checkpoint; không gửi toàn bộ mỗi frame hoặc flush trống                                    | Backend chấm, khóa lượt, snapshot luật, requestId/revision, chốt deadline; gửi lại giữ token cũ                                                 |
| Biểu mẫu                    | Chỉ gửi sau validation; không tra username mỗi lần gõ                                                          | Backend vẫn kiểm tra dữ liệu/quyền; invalid draft bị từ chối trước đọc cấu hình game                                                            |

Cache hoàn tất chỉ dành cho history/students_page/assessment_results/assessment_attempts khi tài khoản là admin: tối đa 60 khóa, TTL 30 giây, khóa gồm action và mọi tham số. Xóa cache khi mutation, login/logout/đổi người dùng, focus/visibility và sự kiện quyền lớp. Phản hồi đọc của phiên cũ bị từ chối bằng epoch. Học sinh không dùng cache hoàn tất cho dữ liệu riêng. Nút Làm mới lịch sử chủ động xóa cache.

Tặng sao không tải lại bảng thời gian không thay đổi hoặc sao header của giáo viên. Đổi thành viên vá dữ liệu hiện có; tạo/sửa lớp chỉ tải danh sách lớp, không bootstrap lại catalog/avatar. Reset chỉ tải lại thống kê cần thiết. Không thay engine hay phần Từ vựng.

## File/form đã sửa

- `src/components/ValidatedForm.jsx`, `src/styles/tipy-ui.css`: kiểm tra tại máy, lỗi dưới trường, focus, aria, nhãn ổn định; style chỉ áp dụng thông báo mới.
- `src/components/Account.jsx`, `src/screens/AdminPage.jsx`: đăng nhập/đăng ký, mật khẩu giữ nguyên, chống gửi trùng; form cấu hình game kiểm tra giới hạn và quan hệ tốc độ.
- `src/features/classroom/AdminClasses.jsx`: tạo/đổi tên/xóa lớp; khoảng trắng và tên xác nhận; chỉ tải phần thay đổi.
- `src/features/classroom/PostComposer.jsx`: tiêu đề/link/tệp trước upload; giữ preview/lazy/private hiện có.
- `src/features/admin/StudentActionDialog.jsx`, `StudentsTable.jsx`: tặng sao/reset/xóa tài khoản, số nguyên/accept/tên đăng nhập; một hàm submit cho Enter và nút.
- `src/features/admin/StudentHistory.jsx`: tìm kiếm/phân trang người chọn, cache lịch sử và làm mới chủ động.
- `src/features/assessments/AdminAssessments.jsx`: tên đề, lịch mở/đóng, always bỏ qua ngày giờ, số lượt/điểm mục tiêu, bộ phím; xóa đề bằng accept và Enter.
- `src/features/assessments/AssessmentsPage.jsx`, `session.js`: bỏ polling idle, không checkpoint rỗng, không đuổi theo từng frame khi mạng chậm; chống retry deadline dồn mỗi giây bằng backoff tối đa 30 giây.
- `src/game/backend.js`, `AccountPoints.jsx`, `AvatarPicker.jsx`, `ClassAchievements.jsx`: cache theo phiên, chống stale/double-save, bỏ polling và tải lại không liên quan.
- `server/modules/classrooms.js`, `assessments.js`: thu hẹp projection và từ chối draft sai trước query.
- Migration, script/test đo kiểm và `design-system/tipy/MASTER.md`; `.gitignore` bỏ file tạm CLI.

## Migration và lịch định kỳ

Đã tạo bằng CLI: `supabase/migrations/20261113042630_assessment_result_summary.sql`. Chỉ replace hàm summary hiện có; không tạo bảng, index, tài khoản hay nới grants/RLS. Đã áp dụng và kiểm tra trong PGlite fixture. **Đã áp dụng Supabase live** `pjzsszjcymcfyamycidx` ngày 13/11/2026, version `20261113042630`. Đã kiểm tra lịch sử và quyền EXECUTE: chỉ service_role/postgres, anon/authenticated không có quyền. Tên file đã đồng bộ version do MCP ghi nhận để tránh chạy lặp bằng CLI. Các số đo ở trên vẫn là fixture; kiểm tra production được ghi riêng sau triển khai.

Đã đọc metadata live về index và cron, không đọc log. Giữ:

- `zunimo-assessment-deadlines`, `* * * * *`, active: chốt lượt hết hạn độc lập trình duyệt, từ checkpoint server đã xác minh.
- `zunimo-weekly-stars`, `5 17 * * *`, active: chạy 00:05 giờ Việt Nam hằng ngày để chốt các tuần đã kết thúc và xử lý tuần bỏ lỡ; RPC chống thưởng trùng.
- Heartbeat/checkpoint khi thực chơi: phục hồi lượt, chống gian lận thời gian và đủ dữ liệu chốt khi mất mạng. Timer đồng hồ UI một giây không tự gọi API trước deadline. Đến deadline chỉ một yêu cầu đang chạy; lỗi được backoff.

## Kiểm tra và phần chưa đo

- `npm test`: 128/128 đạt; SQL quyền, hai tab, replay, sao, IME, avatar, lịch sử, Từ vựng và lớp học.
- `npm run build`: đạt; code splitting còn nguyên.
- `scripts/check-request-budget.mjs`: số đo bảng trên; `--class-only` đo mở lớp.
- `scripts/check-form-requests.mjs`: sai bằng nút/Enter tạo 0 request; hợp lệ bằng Enter và bấm đúp mỗi lần 1 lưu; focus/lỗi sửa tại máy; always bỏ lịch sai; 320/768/1440 không tràn.
- `scripts/check-result-query.mjs`: JSON, EXPLAIN, 7 hàng và nội dung hiển thị không đổi.
- `scripts/check-assessments.mjs`: API thật + PGlite + Chrome 320/768/1440; nháp/chọn/giao/làm/nộp, reload tiếp tục lượt, học sinh vào sau/rời lớp, kết quả riêng, deadline, Chi tiết, phân trang, không ghi sao luyện tập.
- `scripts/check-class-access.mjs`, `check-admin-students.mjs`: khách/chưa có lớp/thành viên/admin, đăng nhập/reload/thu hồi quyền, lọc/trang/bulk/xác nhận/thử lại ở các kích thước đã ghi trong script.
- `git diff --check` và Prettier các file đã sửa: đạt.
- Mạng mất kết nối ngắn: đã thử lỗi request và retry giữ token trong unit test; **chưa đo** offline phần cứng/browser end-to-end. Hai tab được kiểm tra ở service/transaction fixture, chưa đo đồng thời hai thiết bị thật.
- **Chưa đo** trước/sau cho từng form/bảng lịch sử trên production, tải lớn nhiều học sinh đồng thời, số byte mạng đã nén và hành vi mạng di động thật. Không tuyên bố số liệu fixture là số production.
- **Log Query GB mới: Chưa đo**. Mốc cũ 97,637 GB của kỳ 09/11–09/12/2026 chỉ là số ghi nhận trước, không dùng tính mức tiết kiệm của thay đổi này. Request ứng dụng và GB quét log là hai chỉ số riêng; không hứa mức đã dùng trong kỳ giảm xuống.

Tham chiếu API projection hiện tại: https://supabase.com/docs/reference/javascript/select. Đã xem changelog Supabase trước thay đổi; không nâng SDK/CLI hay thêm thư viện vào package.json.
